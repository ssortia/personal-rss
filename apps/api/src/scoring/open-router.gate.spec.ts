import { getEnv } from '../config/env';

import { OpenRouterGate } from './open-router.gate';

// Мокируем openai: создаём стабильную jest.fn() для create
jest.mock('openai', () => {
  const mockCreate = jest.fn();

  // APIError совместимая заглушка: (status, error, message, headers)
  class MockAPIError extends Error {
    status: number;
    headers: Headers;
    error: unknown;

    constructor(
      status: number,
      error: unknown,
      message: string,
      headers: Record<string, string> = {},
    ) {
      super(message);
      this.name = 'APIError';
      this.status = status;
      this.error = error;
      // Оборачиваем в Headers чтобы поддержать .get()
      this.headers = new Headers(headers);
    }
  }

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    APIError: MockAPIError,
  };
});

jest.mock('../config/env', () => ({
  getEnv: jest.fn(),
}));

const mockGetEnv = getEnv as jest.MockedFunction<typeof getEnv>;

// Тип мока точнее реального APIError: конструктор принимает Record<string, string> для headers
type MockAPIErrorCtor = new (
  status: number,
  error: unknown,
  message: string,
  headers?: Record<string, string>,
) => { status: number; headers: Headers; error: unknown; message: string; name: string };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { APIError: MockAPIError } = require('openai') as { APIError: MockAPIErrorCtor };

describe('OpenRouterGate', () => {
  beforeEach(() => {
    mockGetEnv.mockReturnValue({
      OPENROUTER_API_KEY: 'test-openrouter-key',
    } as ReturnType<typeof getEnv>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('true когда OPENROUTER_API_KEY задан', () => {
      const gate = new OpenRouterGate();
      expect(gate.isAvailable).toBe(true);
    });

    it('false когда OPENROUTER_API_KEY пустой', () => {
      mockGetEnv.mockReturnValueOnce({ OPENROUTER_API_KEY: '' } as ReturnType<typeof getEnv>);
      const gate = new OpenRouterGate();
      expect(gate.isAvailable).toBe(false);
    });

    it('false когда OPENROUTER_API_KEY не задан', () => {
      mockGetEnv.mockReturnValueOnce({} as ReturnType<typeof getEnv>);
      const gate = new OpenRouterGate();
      expect(gate.isAvailable).toBe(false);
    });
  });

  describe('chat', () => {
    let gate: OpenRouterGate;
    let mockCreate: jest.Mock;

    beforeEach(() => {
      gate = new OpenRouterGate();
      mockCreate = (gate as unknown as { client: { chat: { completions: { create: jest.Mock } } } })
        .client.chat.completions.create;
    });

    it('возвращает null когда client равен null (нет API ключа)', async () => {
      mockGetEnv.mockReturnValueOnce({ OPENROUTER_API_KEY: '' } as ReturnType<typeof getEnv>);
      const gateNoKey = new OpenRouterGate();
      const result = await gateNoKey.chat([{ role: 'user', content: 'test' }]);
      expect(result).toBeNull();
    });

    it('возвращает null когда circuit открыт', async () => {
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

    it('возвращает null при не-429 ошибке и инкрементирует failureCount', async () => {
      mockCreate.mockRejectedValue(new Error('Connection refused'));
      const result = await gate.chat([{ role: 'user', content: 'test' }]);
      expect(result).toBeNull();
      expect((gate as unknown as { failureCount: number }).failureCount).toBe(1);
    });

    it('возвращает null при APIError с не-429 статусом и инкрементирует failureCount', async () => {
      mockCreate.mockRejectedValue(new MockAPIError(500, {}, 'Internal Server Error', undefined));
      const result = await gate.chat([{ role: 'user', content: 'test' }]);
      expect(result).toBeNull();
      expect((gate as unknown as { failureCount: number }).failureCount).toBe(1);
    });

    it('открывает circuit breaker после FAILURE_THRESHOLD (3) ошибок подряд', async () => {
      mockCreate.mockRejectedValue(new Error('Server error'));
      await gate.chat([{ role: 'user', content: 'test' }]);
      await gate.chat([{ role: 'user', content: 'test' }]);
      await gate.chat([{ role: 'user', content: 'test' }]);
      expect((gate as unknown as { circuitOpenUntil: number }).circuitOpenUntil).toBeGreaterThan(
        Date.now(),
      );
    });

    it('использует AI_MODEL из env если задан', async () => {
      mockGetEnv.mockReturnValue({
        OPENROUTER_API_KEY: 'test-key',
        AI_MODEL: 'anthropic/claude-3-haiku',
      } as ReturnType<typeof getEnv>);
      const gateWithModel = new OpenRouterGate();
      const mockCreateOverride = (
        gateWithModel as unknown as { client: { chat: { completions: { create: jest.Mock } } } }
      ).client.chat.completions.create;
      mockCreateOverride.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });

      await gateWithModel.chat([{ role: 'user', content: 'test' }]);

      expect(mockCreateOverride).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'anthropic/claude-3-haiku' }),
      );
    });

    it('использует дефолтную модель openai/gpt-4o-mini если AI_MODEL не задан', async () => {
      mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
      await gate.chat([{ role: 'user', content: 'test' }]);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'openai/gpt-4o-mini' }),
      );
    });

    describe('retry с таймерами', () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('ретраит при APIError 429 и возвращает результат после успеха', async () => {
        const rateLimitErr = new MockAPIError(429, {}, 'rate limit', undefined);

        mockCreate
          .mockRejectedValueOnce(rateLimitErr)
          .mockRejectedValueOnce(rateLimitErr)
          .mockResolvedValueOnce({ choices: [{ message: { content: 'success after retry' } }] });

        const promise = gate.chat([{ role: 'user', content: 'test' }]);
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe('success after retry');
        expect(mockCreate).toHaveBeenCalledTimes(3);
      });

      it('возвращает null после исчерпания MAX_RETRIES (4) при постоянном 429', async () => {
        mockCreate.mockRejectedValue(new MockAPIError(429, {}, 'rate limit', undefined));

        const promise = gate.chat([{ role: 'user', content: 'test' }]);
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toBeNull();
        expect(mockCreate).toHaveBeenCalledTimes(4);
      });

      it('использует Retry-After из заголовка если присутствует', async () => {
        const rateLimitWithHeader = new MockAPIError(429, {}, 'rate limit', { 'retry-after': '5' });
        mockCreate
          .mockRejectedValueOnce(rateLimitWithHeader)
          .mockResolvedValueOnce({ choices: [{ message: { content: 'ok' } }] });

        const setSpy = jest.spyOn(global, 'setTimeout');
        const promise = gate.chat([{ role: 'user', content: 'test' }]);
        await jest.runAllTimersAsync();
        await promise;

        // 5 секунд + 200ms запас = 5200ms
        expect(setSpy).toHaveBeenCalledWith(expect.any(Function), 5200);
      });
    });
  });
});
