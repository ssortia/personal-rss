import { Inject, Injectable, Logger } from '@nestjs/common';
import { SourceType } from '@prisma/client';

import { ArticlesRepository } from '../articles/articles.repository';
import { getEnv } from '../config/env';
import { PreferencesRepository } from '../preferences/preferences.repository';

import { AI_GATEWAY, type AiGateway } from './ai-gateway.interface';
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
    @Inject(AI_GATEWAY) private readonly aiGateway: AiGateway,
  ) {}

  /**
   * Оценивает статьи источника для пользователя батчами (1 запрос = N статей).
   * Обрабатывает только статьи без существующей оценки (UserArticle).
   *
   * Если AI недоступен — пропускаем оценку полностью.
   * Статьи остаются неоценёнными до следующего успешного цикла.
   *
   * Случайный jitter 0–2с перед стартом, чтобы размазать пики при параллельной
   * оценке нескольких пользователей одного источника.
   */
  async scoreForUser(userId: string, sourceId: string, sourceType: SourceType): Promise<void> {
    try {
      // Не сохраняем нейтральные fallback-оценки при недоступности AI
      if (!this.aiGateway.isAvailable) {
        this.logger.warn(`AI недоступен, пропускаем оценку для userId=${userId}`);
        return;
      }

      const [articles, settings] = await Promise.all([
        this.articlesRepository.findUnscoredBySource(userId, sourceId),
        this.preferencesRepository.getSettings(userId),
      ]);

      if (articles.length === 0) return;

      const { GROQ_BATCH_SIZE, GROQ_BATCH_DELAY_MS, GROQ_TPM_LIMIT } = getEnv();

      // Случайный jitter перед первым батчем — размазывает пики при параллельной оценке
      const jitterMs = Math.floor(Math.random() * 2000);
      await new Promise((r) => setTimeout(r, jitterMs));

      for (let i = 0; i < articles.length; i += GROQ_BATCH_SIZE) {
        const batch = articles.slice(i, i + GROQ_BATCH_SIZE);
        const results = await this.scoringService.scoreBatch(
          batch.map((a) => ({ ...a, sourceType })),
          settings.selectedCategories,
          settings.interestsText,
        );

        // Собираем batch-обновление AI-контента вместо N отдельных запросов
        const aiUpdates = batch
          .map((article, j) => ({ article, result: results[j]! }))
          .filter(({ result }) => result.aiContent != null)
          .map(({ article, result }) => ({
            articleId: article.id,
            sourceType,
            aiContent: result.aiContent!,
          }));

        // allSettled не прерывает обработку при ошибке одной статьи
        const settled = await Promise.allSettled([
          ...batch.map((article, j) =>
            this.articlesRepository.upsertUserArticle(
              userId,
              article.id,
              results[j]!.score,
              results[j]!.reason,
            ),
          ),
          // Один транзакционный вызов вместо N
          this.articlesRepository.updateAiContentBatch(aiUpdates),
        ]);

        for (const result of settled) {
          if (result.status === 'rejected') {
            this.logger.error({ err: result.reason }, 'Ошибка сохранения оценки статьи');
          }
        }

        // Динамическая задержка с учётом TPM-лимита, кроме последнего батча
        if (i + GROQ_BATCH_SIZE < articles.length) {
          const estimatedTokens = GROQ_BATCH_SIZE * 150;
          const minDelayForTpm = (estimatedTokens / GROQ_TPM_LIMIT) * 60_000;
          const delay = Math.max(GROQ_BATCH_DELAY_MS, minDelayForTpm);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    } catch (err) {
      this.logger.error(`Ошибка AI-оценки статей для userId=${userId}: ${String(err)}`);
    }
  }
}
