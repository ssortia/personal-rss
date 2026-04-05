import { Injectable } from '@nestjs/common';
import Groq, { RateLimitError } from 'groq-sdk';

import { getEnv } from '../config/env';

import { AbstractAiGate } from './abstract-ai-gate';
import type { AiChatOptions, AiMessage } from './ai-gateway.interface';

export interface GroqChatOptions extends AiChatOptions {
  /** Переопределяет модель Groq для конкретного вызова. */
  model?: string;
}

/**
 * Gate для Groq API.
 * Circuit breaker и retry-логика унаследованы от AbstractAiGate.
 */
@Injectable()
export class GroqGate extends AbstractAiGate {
  private readonly client: Groq | null;

  constructor() {
    super();
    const { GROQ_API_KEY } = getEnv();
    this.client = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  protected async doRequest(messages: AiMessage[], options: AiChatOptions): Promise<string> {
    const groqOptions = options as GroqChatOptions;
    const response = await this.client!.chat.completions.create({
      // Явный параметр вызова → AI_MODEL из env → дефолт провайдера
      model: groqOptions.model ?? getEnv().AI_MODEL ?? 'llama-3.3-70b-versatile',
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 100,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  protected isRateLimitError(err: unknown): boolean {
    return err instanceof RateLimitError;
  }

  /** Извлекает время ожидания из сообщения Groq ("try again in 2s"). */
  protected parseRetryAfterMs(err: unknown): number | null {
    if (!(err instanceof RateLimitError)) return null;
    const match = /try again in (\d+(?:\.\d+)?)s/i.exec(err.message);
    if (match?.[1]) {
      return Math.ceil(parseFloat(match[1]) * 1000) + 200; // +200ms запас
    }
    return null;
  }
}
