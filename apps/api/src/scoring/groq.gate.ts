import { Injectable, Logger } from '@nestjs/common';
import Groq, { RateLimitError } from 'groq-sdk';

import { getEnv } from '../config/env';

export interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GroqChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Gate — тонкая обёртка над внешним HTTP-API Groq.
 * Отвечает исключительно за транспорт: отправить запрос, получить текст ответа,
 * обработать сетевые/rate-limit ошибки. Никакой бизнес-логики.
 */
@Injectable()
export class GroqGate {
  private readonly logger = new Logger(GroqGate.name);
  private readonly client: Groq | null;

  constructor() {
    const { GROQ_API_KEY } = getEnv();
    this.client = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Отправляет сообщения в Groq Chat API и возвращает текст ответа.
   * При 429 ждёт указанное в ответе время и повторяет один раз.
   * При любой другой ошибке возвращает null.
   */
  async chat(messages: GroqMessage[], options: GroqChatOptions = {}): Promise<string | null> {
    if (!this.client) return null;

    try {
      return await this.doRequest(messages, options);
    } catch (err) {
      if (err instanceof RateLimitError) {
        const retryMs = this.parseRetryAfterMs(err) ?? 5000;
        this.logger.warn(`Rate limit Groq, повтор через ${retryMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, retryMs));
        try {
          return await this.doRequest(messages, options);
        } catch (retryErr) {
          this.logger.warn(`Groq повторная ошибка: ${String(retryErr)}`);
          return null;
        }
      }
      this.logger.warn(`Groq ошибка: ${String(err)}`);
      return null;
    }
  }

  private async doRequest(messages: GroqMessage[], options: GroqChatOptions): Promise<string> {
    const response = await this.client!.chat.completions.create({
      model: options.model ?? 'llama-3.3-70b-versatile',
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 100,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  /** Извлекает время ожидания из сообщения Groq ("try again in 2s"). */
  private parseRetryAfterMs(err: RateLimitError): number | null {
    const match = /try again in (\d+(?:\.\d+)?)s/i.exec(err.message);
    if (match?.[1]) {
      return Math.ceil(parseFloat(match[1]) * 1000) + 200; // +200ms запас
    }
    return null;
  }
}
