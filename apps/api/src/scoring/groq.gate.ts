import { Injectable, Logger } from '@nestjs/common';
import Groq, { RateLimitError } from 'groq-sdk';

import { getEnv } from '../config/env';

import type { AiChatOptions, AiGateway, AiMessage } from './ai-gateway.interface';

export interface GroqChatOptions extends AiChatOptions {
  model?: string;
  temperature?: number;
}

/**
 * Gate — тонкая обёртка над внешним HTTP-API Groq.
 * Отвечает исключительно за транспорт: отправить запрос, получить текст ответа,
 * обработать сетевые/rate-limit ошибки. Никакой бизнес-логики.
 */
@Injectable()
export class GroqGate implements AiGateway {
  private readonly logger = new Logger(GroqGate.name);
  private readonly client: Groq | null;

  // Circuit breaker — после FAILURE_THRESHOLD ошибок подряд блокирует запросы на CIRCUIT_OPEN_DURATION_MS
  private failureCount = 0;
  private circuitOpenUntil = 0;
  private static readonly FAILURE_THRESHOLD = 3;
  private static readonly CIRCUIT_OPEN_DURATION_MS = 60_000; // 1 минута

  // Максимальное число попыток при rate limit (exponential backoff)
  private static readonly MAX_RETRIES = 4;

  constructor() {
    const { GROQ_API_KEY } = getEnv();
    this.client = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Отправляет сообщения в Groq Chat API и возвращает текст ответа.
   *
   * Exponential backoff до MAX_RETRIES попыток при rate limit.
   * Circuit breaker — после FAILURE_THRESHOLD ошибок подряд
   * запросы блокируются на CIRCUIT_OPEN_DURATION_MS без обращения к API.
   */
  async chat(messages: AiMessage[], options: GroqChatOptions = {}): Promise<string | null> {
    if (!this.client) return null;

    // Circuit OPEN — не пробуем, экономим квоту и время
    if (Date.now() < this.circuitOpenUntil) {
      this.logger.warn('Groq circuit open, пропускаем запрос');
      return null;
    }

    for (let attempt = 0; attempt < GroqGate.MAX_RETRIES; attempt++) {
      try {
        const result = await this.doRequest(messages, options);
        // Сброс счётчика при успехе
        this.failureCount = 0;
        return result;
      } catch (err) {
        if (!(err instanceof RateLimitError)) {
          // Не rate-limit — retry не поможет
          this.logger.warn({ err }, 'Groq ошибка');
          this.recordFailure();
          return null;
        }

        if (attempt === GroqGate.MAX_RETRIES - 1) {
          this.logger.error('Groq rate limit: исчерпаны все попытки');
          this.recordFailure();
          return null;
        }

        // Берём Retry-After из заголовка Groq или экспоненциальный backoff
        const retryMs = this.parseRetryAfterMs(err) ?? Math.min(1000 * 2 ** attempt, 30_000);
        this.logger.warn(
          `Groq rate limit (попытка ${attempt + 1}/${GroqGate.MAX_RETRIES}), ожидание ${retryMs}ms`,
        );
        await new Promise((r) => setTimeout(r, retryMs));
      }
    }

    return null;
  }

  private async doRequest(messages: AiMessage[], options: GroqChatOptions): Promise<string> {
    const response = await this.client!.chat.completions.create({
      model: options.model ?? 'llama-3.3-70b-versatile',
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 100,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  /** Фиксирует отказ и открывает circuit при превышении порога. */
  private recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= GroqGate.FAILURE_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + GroqGate.CIRCUIT_OPEN_DURATION_MS;
      this.logger.error(
        `Groq circuit открыт на ${GroqGate.CIRCUIT_OPEN_DURATION_MS / 1000}с после ${this.failureCount} ошибок`,
      );
    }
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
