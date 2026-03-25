import { Inject, Injectable, Logger } from '@nestjs/common';
import { SourceType } from '@prisma/client';

import { SCORING_CONTENT_PREVIEW_LENGTH, SCORING_TOKENS_PER_ARTICLE } from '../config/constants';

import { AI_GATEWAY, type AiGateway } from './ai-gateway.interface';

interface ArticleInput {
  title: string;
  content: string | null;
  sourceType: SourceType;
}

interface ScoreResult {
  score: number;
  reason: string | null;
  /** Для RSS: краткое содержание (1–2 предл.). Для Telegram: AI-заголовок (1 строка). */
  aiContent: string | null;
}

/** Нейтральная оценка — используется когда Gate недоступен или вернул некорректный ответ. */
const NEUTRAL: ScoreResult = { score: 0.5, reason: null, aiContent: null };

/** Приводит score к диапазону [0, 1]. */
function clampScore(value: unknown): number {
  return typeof value === 'number' ? Math.min(1, Math.max(0, value)) : 0.5;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(@Inject(AI_GATEWAY) private readonly aiGateway: AiGateway) {}

  /**
   * Оценивает батч статей за один запрос к Groq.
   * Возвращает массив результатов в том же порядке, что и входные статьи.
   * При ошибке парсинга отдельных элементов подставляет NEUTRAL.
   */
  async scoreBatch(
    articles: ArticleInput[],
    categories: string[],
    interestsText?: string | null,
  ): Promise<ScoreResult[]> {
    if (!this.aiGateway.isAvailable) {
      return articles.map(() => NEUTRAL);
    }

    const categoryList = categories.length > 0 ? categories.join(', ') : 'не указаны';
    const interestsLine = interestsText ? `User interests (free text): ${interestsText}\n` : '';

    const articlesList = articles
      .map((a, i) => {
        const content = (a.content ?? '').slice(0, SCORING_CONTENT_PREVIEW_LENGTH);
        const type = a.sourceType === SourceType.TELEGRAM ? 'TELEGRAM' : 'RSS';
        return `${i + 1}. [${type}] Title: "${a.title}"\n   Content: "${content}"`;
      })
      .join('\n');

    const prompt = `You are a news relevance scorer. Score these ${articles.length} articles for relevance to the user's interests.
Return a JSON array with exactly ${articles.length} objects in the same order as the articles.

${interestsLine}User interests (categories): ${categoryList}

Articles:
${articlesList}

Respond ONLY with a valid JSON array in this exact format:
[{"score": 0.8, "reason": "...", "aiContent": "..."}, ...]

Rules:
- score is a float from 0.0 to 1.0
- reason is a short explanation (1 sentence)
- aiContent rules depend on article type:
  - [TELEGRAM]: generate a short title (5-8 words) summarising the post
  - [RSS]: generate a 1-2 sentence summary of the article
- Write "reason" and "aiContent" in the same language as the article content
- Array must have exactly ${articles.length} elements`;

    // Увеличиваем лимит токенов пропорционально размеру батча
    const maxTokens = SCORING_TOKENS_PER_ARTICLE * articles.length;
    const text = await this.aiGateway.chat([{ role: 'user', content: prompt }], { maxTokens });

    if (!text) {
      return articles.map(() => NEUTRAL);
    }

    try {
      // Извлекаем первый JSON-массив из ответа (модель может добавить текст вокруг)
      const match = /\[[\s\S]*\]/.exec(text);
      if (!match) throw new Error('JSON-массив не найден в ответе');

      const parsed = JSON.parse(match[0]) as unknown[];

      if (!Array.isArray(parsed)) {
        throw new Error('Ответ Groq не является JSON-массивом');
      }

      if (parsed.length !== articles.length) {
        this.logger.warn(
          `Groq вернул ${parsed.length} оценок вместо ${articles.length}, недостающие → NEUTRAL`,
        );
      }

      return articles.map((_, i) => {
        const item = parsed[i];
        if (!item || typeof item !== 'object') return NEUTRAL;
        const obj = item as Record<string, unknown>;
        return {
          score: clampScore(obj['score']),
          reason: typeof obj['reason'] === 'string' ? obj['reason'] : null,
          aiContent: typeof obj['aiContent'] === 'string' ? obj['aiContent'] : null,
        };
      });
    } catch (err) {
      this.logger.warn(`Не удалось распарсить батч-ответ Groq: ${String(err)}\nОтвет: ${text}`);
      return articles.map(() => NEUTRAL);
    }
  }
}
