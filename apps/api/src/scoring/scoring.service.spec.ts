import { SourceType } from '@prisma/client';

import { SCORING_TOKENS_PER_ARTICLE } from '../config/constants';

import type { AiGateway } from './ai-gateway.interface';
import { ScoringService } from './scoring.service';

const makeArticle = (
  override: Partial<{ title: string; content: string | null; sourceType: SourceType }> = {},
) => ({
  title: 'Test article',
  content: 'Test content',
  sourceType: SourceType.RSS,
  ...override,
});

describe('ScoringService', () => {
  let mockGateway: { isAvailable: boolean; chat: jest.Mock };
  let service: ScoringService;

  beforeEach(() => {
    mockGateway = { isAvailable: true, chat: jest.fn() };
    service = new ScoringService(mockGateway as unknown as AiGateway);
  });

  describe('когда AI недоступен', () => {
    it('возвращает NEUTRAL для каждой статьи без вызова chat', async () => {
      mockGateway.isAvailable = false;
      const result = await service.scoreBatch([makeArticle(), makeArticle()], []);
      expect(result).toHaveLength(2);
      expect(
        result.every((r) => r.score === 0.5 && r.reason === null && r.aiContent === null),
      ).toBe(true);
      expect(mockGateway.chat).not.toHaveBeenCalled();
    });
  });

  describe('когда chat возвращает null', () => {
    it('возвращает NEUTRAL для всех статей', async () => {
      mockGateway.chat.mockResolvedValue(null);
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result).toEqual([{ score: 0.5, reason: null, aiContent: null }]);
    });
  });

  describe('валидный JSON-ответ', () => {
    it('корректно парсит score, reason, aiContent', async () => {
      mockGateway.chat.mockResolvedValue(
        JSON.stringify([{ score: 0.8, reason: 'Relevant', aiContent: 'Summary' }]),
      );
      const result = await service.scoreBatch([makeArticle()], ['tech']);
      expect(result[0]).toEqual({ score: 0.8, reason: 'Relevant', aiContent: 'Summary' });
    });

    it('score > 1 → clamp до 1.0', async () => {
      mockGateway.chat.mockResolvedValue(
        JSON.stringify([{ score: 1.5, reason: null, aiContent: null }]),
      );
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result[0]?.score).toBe(1);
    });

    it('score < 0 → clamp до 0.0', async () => {
      mockGateway.chat.mockResolvedValue(
        JSON.stringify([{ score: -0.3, reason: null, aiContent: null }]),
      );
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result[0]?.score).toBe(0);
    });

    it('score не является числом → 0.5', async () => {
      mockGateway.chat.mockResolvedValue(
        JSON.stringify([{ score: 'high', reason: null, aiContent: null }]),
      );
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result[0]?.score).toBe(0.5);
    });

    it('reason не является строкой → null', async () => {
      mockGateway.chat.mockResolvedValue(
        JSON.stringify([{ score: 0.7, reason: 42, aiContent: null }]),
      );
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result[0]?.reason).toBeNull();
    });

    it('aiContent не является строкой → null', async () => {
      mockGateway.chat.mockResolvedValue(
        JSON.stringify([{ score: 0.7, reason: 'ok', aiContent: 123 }]),
      );
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result[0]?.aiContent).toBeNull();
    });

    it('JSON заключён в текст вокруг массива — всё равно парсится', async () => {
      mockGateway.chat.mockResolvedValue(
        'Here is the result:\n[{"score":0.9,"reason":"good","aiContent":"summary"}]\nDone.',
      );
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result[0]?.score).toBe(0.9);
    });
  });

  describe('несоответствие длины ответа', () => {
    it('меньше элементов чем статей → недостающие заполняются NEUTRAL', async () => {
      mockGateway.chat.mockResolvedValue(
        JSON.stringify([{ score: 0.9, reason: 'ok', aiContent: null }]),
      );
      const result = await service.scoreBatch([makeArticle(), makeArticle()], []);
      expect(result[0]?.score).toBe(0.9);
      expect(result[1]).toEqual({ score: 0.5, reason: null, aiContent: null });
    });

    it('пустой объект вместо нужных полей → дефолтные значения', async () => {
      mockGateway.chat.mockResolvedValue(JSON.stringify([{}]));
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result[0]).toEqual({ score: 0.5, reason: null, aiContent: null });
    });
  });

  describe('содержимое промпта', () => {
    beforeEach(() => {
      mockGateway.chat.mockResolvedValue(
        JSON.stringify([{ score: 0.5, reason: null, aiContent: null }]),
      );
    });

    it('включает interestsText в промпт если задан', async () => {
      await service.scoreBatch([makeArticle()], [], 'AI and robotics');
      const messages = mockGateway.chat.mock.calls[0]?.[0] as Array<{ content: string }>;
      expect(messages[0]?.content).toContain('AI and robotics');
    });

    it('не добавляет строку interestsText если null', async () => {
      await service.scoreBatch([makeArticle()], [], null);
      const messages = mockGateway.chat.mock.calls[0]?.[0] as Array<{ content: string }>;
      expect(messages[0]?.content).not.toContain('User interests (free text)');
    });

    it('маркирует RSS-статьи как [RSS] в промпте', async () => {
      await service.scoreBatch([makeArticle({ sourceType: SourceType.RSS })], []);
      const messages = mockGateway.chat.mock.calls[0]?.[0] as Array<{ content: string }>;
      expect(messages[0]?.content).toContain('[RSS]');
    });

    it('маркирует Telegram-статьи как [TELEGRAM] в промпте', async () => {
      await service.scoreBatch([makeArticle({ sourceType: SourceType.TELEGRAM })], []);
      const messages = mockGateway.chat.mock.calls[0]?.[0] as Array<{ content: string }>;
      expect(messages[0]?.content).toContain('[TELEGRAM]');
    });

    it('передаёт maxTokens пропорционально количеству статей', async () => {
      const articles = [makeArticle(), makeArticle(), makeArticle()];
      mockGateway.chat.mockResolvedValue(
        JSON.stringify(articles.map(() => ({ score: 0.5, reason: null, aiContent: null }))),
      );
      await service.scoreBatch(articles, []);
      const options = mockGateway.chat.mock.calls[0]?.[1] as { maxTokens: number };
      expect(options.maxTokens).toBe(SCORING_TOKENS_PER_ARTICLE * 3);
    });
  });

  describe('невалидный JSON', () => {
    it('нет JSON-массива в ответе → все NEUTRAL', async () => {
      mockGateway.chat.mockResolvedValue('Ответ без JSON-массива');
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result).toEqual([{ score: 0.5, reason: null, aiContent: null }]);
    });

    it('невалидный JSON → все NEUTRAL', async () => {
      mockGateway.chat.mockResolvedValue('[invalid json content]');
      const result = await service.scoreBatch([makeArticle()], []);
      expect(result).toEqual([{ score: 0.5, reason: null, aiContent: null }]);
    });
  });
});
