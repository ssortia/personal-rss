import { Injectable } from '@nestjs/common';
import OpenAI, { APIError } from 'openai';

import { getEnv } from '../config/env';

import { AbstractAiGate } from './abstract-ai-gate';
import type { AiChatOptions, AiMessage } from './ai-gateway.interface';

/** Дефолтная модель OpenRouter — быстрая и дешёвая для задачи оценки статей. */
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

/**
 * Gate для OpenRouter — OpenAI-совместимый агрегатор моделей.
 * Circuit breaker и retry-логика унаследованы от AbstractAiGate.
 * OpenRouter принимает OpenAI SDK с кастомным baseURL.
 */
@Injectable()
export class OpenRouterGate extends AbstractAiGate {
  private readonly client: OpenAI | null;

  constructor() {
    super();
    const { OPENROUTER_API_KEY } = getEnv();
    this.client = OPENROUTER_API_KEY
      ? new OpenAI({
          apiKey: OPENROUTER_API_KEY,
          baseURL: 'https://openrouter.ai/api/v1',
        })
      : null;
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  protected async doRequest(messages: AiMessage[], options: AiChatOptions): Promise<string> {
    const response = await this.client!.chat.completions.create({
      model: getEnv().AI_MODEL ?? DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 100,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  protected isRateLimitError(err: unknown): boolean {
    return err instanceof APIError && err.status === 429;
  }

  /** Извлекает время ожидания из заголовка Retry-After или сообщения об ошибке. */
  protected parseRetryAfterMs(err: unknown): number | null {
    if (!(err instanceof APIError)) return null;

    // Заголовок Retry-After (секунды) — headers у APIError имеет тип Headers (web API)
    const retryAfterHeader = err.headers?.get('retry-after');
    if (retryAfterHeader) {
      const seconds = parseFloat(retryAfterHeader);
      if (!isNaN(seconds)) return Math.ceil(seconds * 1000) + 200;
    }

    // Fallback: парсим из сообщения (формат "try again in Xs")
    const match = /try again in (\d+(?:\.\d+)?)s/i.exec(err.message);
    if (match?.[1]) {
      return Math.ceil(parseFloat(match[1]) * 1000) + 200;
    }

    return null;
  }
}
