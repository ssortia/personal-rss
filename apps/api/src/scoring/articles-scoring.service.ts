import { Injectable, Logger } from '@nestjs/common';
import { SourceType } from '@prisma/client';

import { ArticlesRepository } from '../articles/articles.repository';
import { getEnv } from '../config/env';
import { PreferencesRepository } from '../preferences/preferences.repository';

import { ScoringService } from './scoring.service';

/**
 * Оценивает статьи для конкретного пользователя батчами через ScoringService.
 * Вынесен из SourcesService, чтобы разделить ответственность:
 * SourcesService управляет источниками, ArticlesScoringService — AI-оценкой.
 */
@Injectable()
export class ArticlesScoringService {
  private readonly logger = new Logger(ArticlesScoringService.name);

  constructor(
    private readonly scoringService: ScoringService,
    private readonly articlesRepository: ArticlesRepository,
    private readonly preferencesRepository: PreferencesRepository,
  ) {}

  /**
   * Оценивает статьи источника для пользователя батчами (1 запрос = N статей).
   * Обрабатывает только статьи без существующей оценки (UserArticle).
   * Между батчами выдерживает задержку GROQ_BATCH_DELAY_MS для соблюдения 30 RPM лимита.
   * Запускается асинхронно — ошибки не прерывают основной флоу.
   */
  async scoreForUser(userId: string, sourceId: string, sourceType: SourceType): Promise<void> {
    try {
      const [articles, settings] = await Promise.all([
        this.articlesRepository.findUnscoredBySource(userId, sourceId),
        this.preferencesRepository.getSettings(userId),
      ]);

      const { GROQ_BATCH_SIZE, GROQ_BATCH_DELAY_MS } = getEnv();

      for (let i = 0; i < articles.length; i += GROQ_BATCH_SIZE) {
        const batch = articles.slice(i, i + GROQ_BATCH_SIZE);
        const results = await this.scoringService.scoreBatch(
          batch.map((a) => ({ ...a, sourceType })),
          settings.selectedCategories,
          settings.interestsText,
        );

        await Promise.all(
          batch.map(async (article, j) => {
            const result = results[j]!;
            await this.articlesRepository.upsertUserArticle(
              userId,
              article.id,
              result.score,
              result.reason,
            );
            // Сохраняем AI-контент в Article один раз (идемпотентно)
            if (result.aiContent) {
              await this.articlesRepository.updateAiContent(
                article.id,
                sourceType,
                result.aiContent,
              );
            }
          }),
        );

        // Задержка между батчами, кроме последнего
        if (i + GROQ_BATCH_SIZE < articles.length) {
          await new Promise((r) => setTimeout(r, GROQ_BATCH_DELAY_MS));
        }
      }
    } catch (err) {
      this.logger.error(`Ошибка AI-оценки статей для userId=${userId}: ${String(err)}`);
    }
  }
}
