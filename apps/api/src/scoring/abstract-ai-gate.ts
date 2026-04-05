import { Logger } from '@nestjs/common';

import type { AiChatOptions, AiGateway, AiMessage } from './ai-gateway.interface';

/**
 * Базовый класс для AI-gate-ов: инкапсулирует circuit breaker и retry-логику.
 * Подклассы реализуют только transport-методы (Template Method Pattern):
 *   - doRequest() — фактический HTTP-запрос к провайдеру
 *   - isRateLimitError() — распознавание ошибки rate-limit
 *   - parseRetryAfterMs() — извлечение задержки из ответа провайдера
 */
export abstract class AbstractAiGate implements AiGateway {
  // Logger создаётся с именем конкретного подкласса (GroqGate / OpenRouterGate)
  private readonly logger = new Logger(this.constructor.name);

  private failureCount = 0;
  private circuitOpenUntil = 0;

  private static readonly FAILURE_THRESHOLD = 3;
  private static readonly CIRCUIT_OPEN_DURATION_MS = 60_000; // 1 минута
  private static readonly MAX_RETRIES = 4;

  abstract get isAvailable(): boolean;

  /** Выполняет фактический HTTP-запрос к провайдеру. */
  protected abstract doRequest(messages: AiMessage[], options: AiChatOptions): Promise<string>;

  /** Возвращает true если ошибка является rate-limit от данного провайдера. */
  protected abstract isRateLimitError(err: unknown): boolean;

  /**
   * Извлекает рекомендуемое время ожидания из ответа провайдера (мс).
   * Возвращает null если провайдер не передал явное значение.
   */
  protected abstract parseRetryAfterMs(err: unknown): number | null;

  /**
   * Отправляет сообщения провайдеру с circuit breaker + exponential backoff при rate-limit.
   * Возвращает null при ошибке или недоступности провайдера.
   */
  async chat(messages: AiMessage[], options: AiChatOptions = {}): Promise<string | null> {
    if (!this.isAvailable) return null;

    // Circuit OPEN — не пробуем, экономим квоту и время
    if (Date.now() < this.circuitOpenUntil) {
      this.logger.warn('Circuit open, пропускаем запрос');
      return null;
    }

    for (let attempt = 0; attempt < AbstractAiGate.MAX_RETRIES; attempt++) {
      try {
        const result = await this.doRequest(messages, options);
        // Сброс счётчика при успехе
        this.failureCount = 0;
        return result;
      } catch (err) {
        if (!this.isRateLimitError(err)) {
          // Не rate-limit — retry не поможет
          this.logger.warn({ err }, 'Ошибка запроса');
          this.recordFailure();
          return null;
        }

        if (attempt === AbstractAiGate.MAX_RETRIES - 1) {
          this.logger.error('Rate limit: исчерпаны все попытки');
          this.recordFailure();
          return null;
        }

        const retryMs = this.parseRetryAfterMs(err) ?? Math.min(1000 * 2 ** attempt, 30_000);
        this.logger.warn(
          `Rate limit (попытка ${attempt + 1}/${AbstractAiGate.MAX_RETRIES}), ожидание ${retryMs}ms`,
        );
        await new Promise((r) => setTimeout(r, retryMs));
      }
    }

    return null;
  }

  /** Фиксирует отказ и открывает circuit при превышении порога. */
  private recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= AbstractAiGate.FAILURE_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + AbstractAiGate.CIRCUIT_OPEN_DURATION_MS;
      this.logger.error(
        `Circuit открыт на ${AbstractAiGate.CIRCUIT_OPEN_DURATION_MS / 1000}с после ${this.failureCount} ошибок`,
      );
    }
  }
}
