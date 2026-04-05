export const AI_GATEWAY = Symbol('AI_GATEWAY');

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiChatOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Абстракция над любым AI-провайдером (Groq, OpenAI, Claude и др.).
 * ScoringService зависит от этого интерфейса, а не от конкретного GroqGate.
 */
export interface AiGateway {
  /** true, если провайдер сконфигурирован и готов принимать запросы. */
  readonly isAvailable: boolean;

  /**
   * Отправляет сообщения в AI-чат и возвращает текстовый ответ.
   * Возвращает null при ошибке или недоступности провайдера.
   */
  chat(messages: AiMessage[], options?: AiChatOptions): Promise<string | null>;
}
