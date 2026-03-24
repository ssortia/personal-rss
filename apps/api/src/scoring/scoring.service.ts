import { Injectable, Logger } from '@nestjs/common';

import { GroqGate } from './groq.gate';

interface ArticleInput {
  title: string;
  content: string | null;
}

interface ScoreResult {
  score: number;
  reason: string | null;
}

/** Нейтральная оценка — используется когда Gate недоступен или вернул некорректный ответ. */
const NEUTRAL: ScoreResult = { score: 0.5, reason: null };

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly groqGate: GroqGate) {}

  /** Оценивает релевантность статьи для пользователя с заданными интересами. */
  async score(article: ArticleInput, categories: string[]): Promise<ScoreResult> {
    if (!this.groqGate.isAvailable) {
      return NEUTRAL;
    }

    const content = (article.content ?? '').slice(0, 1000);
    const categoryList = categories.length > 0 ? categories.join(', ') : 'не указаны';

    const prompt = `You are a news relevance scorer. Given a user's interests and an article, return a JSON object with a relevance score from 0.0 to 1.0 and a short reason.

User interests (categories): ${categoryList}

Article title: ${article.title}
Article content (excerpt): ${content}

Respond ONLY with valid JSON in this exact format:
{"score": 0.75, "reason": "Covers AI topic directly matching user interests"}

IMPORTANT: Write the "reason" field in the same language as the article content.`;

    const text = await this.groqGate.chat([{ role: 'user', content: prompt }]);

    if (!text) {
      return NEUTRAL;
    }

    try {
      const parsed = JSON.parse(text) as { score?: unknown; reason?: unknown };
      const score = typeof parsed.score === 'number' ? Math.min(1, Math.max(0, parsed.score)) : 0.5;
      const reason = typeof parsed.reason === 'string' ? parsed.reason : null;
      return { score, reason };
    } catch {
      this.logger.warn(`Не удалось распарсить ответ Groq для "${article.title}": ${text}`);
      return NEUTRAL;
    }
  }
}
