import { getEnv } from '../config/env';

import { GroqGate } from './groq.gate';

// Мокируем groq-sdk: создаём стабильную jest.fn() для create и кастомный RateLimitError
jest.mock('groq-sdk', () => {
  const mockCreate = jest.fn();

  class MockRateLimitError extends Error {
    status = 429;
    headers: Record<string, string> = {};
    error: unknown = {};

    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  }

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    RateLimitError: MockRateLimitError,
  };
});

jest.mock('../config/env', () => ({
  getEnv: jest.fn(),
}));

const mockGetEnv = getEnv as jest.MockedFunction<typeof getEnv>;

describe('GroqGate', () => {
  beforeEach(() => {
    mockGetEnv.mockReturnValue({ GROQ_API_KEY: 'test-api-key' } as ReturnType<typeof getEnv>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('true когда GROQ_API_KEY задан', () => {
      const gate = new GroqGate();
      expect(gate.isAvailable).toBe(true);
    });

    it('false когда GROQ_API_KEY пустой', () => {
      mockGetEnv.mockReturnValueOnce({ GROQ_API_KEY: '' } as ReturnType<typeof getEnv>);
      const gate = new GroqGate();
      expect(gate.isAvailable).toBe(false);
    });

    it('false когда GROQ_API_KEY не задан', () => {
      mockGetEnv.mockReturnValueOnce({} as ReturnType<typeof getEnv>);
      const gate = new GroqGate();
      expect(gate.isAvailable).toBe(false);
    });
  });

  describe('chat', () => {
    let gate: GroqGate;
    let mockCreate: jest.Mock;

    beforeEach(() => {
      gate = new GroqGate();
      // Стабильная ссылка на create-мок из замыкания jest.mock
      mockCreate = (gate as unknown as { client: { chat: { completions: { create: jest.Mock } } } })
        .client.chat.completions.create;
    });

    it('возвращает null когда client равен null (нет API ключа)', async () => {
      mockGetEnv.mockReturnValueOnce({ GROQ_API_KEY: '' } as ReturnType<typeof getEnv>);
      const gateNoKey = new GroqGate();
      const result = await gateNoKey.chat([{ role: 'user', content: 'test' }]);
      expect(result).toBeNull();
    });

    it('возвращает null когда circuit открыт', async () => {
      // Открываем circuit вручную
      (gate as unknown as { circuitOpenUntil: number }).circuitOpenUntil = Date.now() + 100_000;
      const result = await gate.chat([{ role: 'user', content: 'test' }]);
      expect(result).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('возвращает текст ответа при успешном запросе', async () => {
      mockCreate.mockResolvedValue({ choices: [{ message: { content: 'AI ответ' } }] });
      const result = await gate.chat([{ role: 'user', content: 'вопрос' }]);
      expect(result).toBe('AI ответ');
    });

    it('сбрасывает failureCount в 0 после успешного запроса', async () => {
      (gate as unknown as { failureCount: number }).failureCount = 2;
      mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
      await gate.chat([{ role: 'user', content: 'test' }]);
      expect((gate as unknown as { failureCount: number }).failureCount).toBe(0);
    });

    it('возвращает null при не-rate-limit ошибке и инкрементирует failureCount', async () => {
      mockCreate.mockRejectedValue(new Error('Connection refused'));
      const result = await gate.chat([{ role: 'user', content: 'test' }]);
      expect(result).toBeNull();
      expect((gate as unknown as { failureCount: number }).failureCount).toBe(1);
    });

    it('открывает circuit breaker после FAILURE_THRESHOLD (3) ошибок подряд', async () => {
      mockCreate.mockRejectedValue(new Error('Server error'));
      // Три ошибки → circuit открывается
      await gate.chat([{ role: 'user', content: 'test' }]);
      await gate.chat([{ role: 'user', content: 'test' }]);
      await gate.chat([{ role: 'user', content: 'test' }]);
      expect((gate as unknown as { circuitOpenUntil: number }).circuitOpenUntil).toBeGreaterThan(
        Date.now(),
      );
    });

    it('ретраит при RateLimitError и возвращает результат после успеха', async () => {
      jest.useFakeTimers();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { RateLimitError: MockRateLimitError } = require('groq-sdk') as {
        RateLimitError: new (msg: string) => Error;
      };
      const rateLimitErr = new MockRateLimitError('rate limit error');

      mockCreate
        .mockRejectedValueOnce(rateLimitErr)
        .mockRejectedValueOnce(rateLimitErr)
        .mockResolvedValueOnce({ choices: [{ message: { content: 'success after retry' } }] });

      const promise = gate.chat([{ role: 'user', content: 'test' }]);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success after retry');
      expect(mockCreate).toHaveBeenCalledTimes(3);
      jest.useRealTimers();
    });

    it('возвращает null после исчерпания MAX_RETRIES (4) при постоянном RateLimitError', async () => {
      jest.useFakeTimers();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { RateLimitError: MockRateLimitError } = require('groq-sdk') as {
        RateLimitError: new (msg: string) => Error;
      };
      mockCreate.mockRejectedValue(new MockRateLimitError('rate limit'));

      const promise = gate.chat([{ role: 'user', content: 'test' }]);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBeNull();
      expect(mockCreate).toHaveBeenCalledTimes(4); // MAX_RETRIES = 4
      jest.useRealTimers();
    });
  });
});
