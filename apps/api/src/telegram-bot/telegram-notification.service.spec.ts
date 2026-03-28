import type { Article, Source, UserArticle, UserPreferences } from '@prisma/client';
import { SourceType } from '@prisma/client';

// p-limit v5+ использует ESM — мокируем чтобы избежать SyntaxError в Jest
jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => Promise<unknown>) => fn(),
}));

import type { PrismaService } from '../prisma/prisma.service';

import type { TelegramBotService } from './telegram-bot.service';
import { TelegramNotificationService } from './telegram-notification.service';

// Вспомогательные фабрики
const makeSource = (type: SourceType = SourceType.RSS): Source => ({
  id: 'src-1',
  url: type === SourceType.TELEGRAM ? 'https://t.me/testchannel' : 'https://example.com/feed',
  title: 'Test Source',
  description: null,
  imageUrl: null,
  type,
  lastFetchAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeArticle = (
  overrides: Partial<Article & { source: Source }> = {},
): Article & {
  source: Source;
} => ({
  id: 'article-1',
  sourceId: 'src-1',
  guid: 'testchannel/42',
  title: 'Test Article',
  url: 'https://t.me/testchannel/42',
  content: 'Some content',
  summary: null,
  aiTitle: null,
  publishedAt: new Date(),
  createdAt: new Date(),
  source: makeSource(),
  ...overrides,
});

const makeUserArticle = (
  overrides: Partial<UserArticle & { article: Article & { source: Source } }> = {},
): UserArticle & {
  article: Article & { source: Source };
} => ({
  id: 'ua-1',
  userId: 'user-1',
  articleId: 'article-1',
  score: 0.8,
  scoreReason: null,
  telegramNotifiedAt: null,
  createdAt: new Date(),
  article: makeArticle(),
  ...overrides,
});

/**
 * Мок только тех методов Prisma, которые использует сервис.
 * jest.Mocked<PrismaService> не подходит — Prisma-делегаты имеют сложные
 * перегруженные типы, несовместимые с автоматическим jest.Mock-преобразованием.
 */
type MockPrisma = {
  user: { findMany: jest.Mock };
  userArticle: { findMany: jest.Mock; update: jest.Mock };
  userPreferences: { findFirst: jest.Mock };
};

describe('TelegramNotificationService', () => {
  let service: TelegramNotificationService;
  let mockBot: jest.Mocked<Pick<TelegramBotService, 'isReady' | 'sendMessage' | 'forwardMessage'>>;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockBot = {
      isReady: jest.fn().mockReturnValue(true),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      forwardMessage: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
      userArticle: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      userPreferences: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    service = new TelegramNotificationService(
      mockBot as unknown as TelegramBotService,
      mockPrisma as unknown as PrismaService,
    );
  });

  describe('notifyAll', () => {
    it('ничего не делает если бот не готов', async () => {
      mockBot.isReady.mockReturnValue(false);
      await service.notifyAll();
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('ничего не делает если нет пользователей с привязанным Telegram', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await service.notifyAll();
      expect(mockPrisma.userArticle.findMany).not.toHaveBeenCalled();
    });

    it('запрашивает статьи только для пользователей с telegramChatId', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '12345' }]);
      await service.notifyAll();
      expect(mockPrisma.userArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
      );
    });
  });

  describe('RSS-статья', () => {
    it('отправляет HTML-сообщение с заголовком, описанием и ссылкой', async () => {
      const article = makeArticle({
        title: 'My Article',
        summary: 'Short summary',
        url: 'https://example.com/1',
        source: makeSource(SourceType.RSS),
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '42' }]);
      mockPrisma.userArticle.findMany.mockResolvedValue([makeUserArticle({ article })]);

      await service.notifyAll();

      expect(mockBot.sendMessage).toHaveBeenCalledWith('42', expect.stringContaining('My Article'));
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '42',
        expect.stringContaining('Short summary'),
      );
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '42',
        expect.stringContaining('https://example.com/1'),
      );
    });

    it('экранирует HTML-спецсимволы в заголовке', async () => {
      const article = makeArticle({
        title: '<script>alert("xss")</script>',
        source: makeSource(SourceType.RSS),
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '42' }]);
      mockPrisma.userArticle.findMany.mockResolvedValue([makeUserArticle({ article })]);

      await service.notifyAll();

      const [, html] = (mockBot.sendMessage as jest.Mock).mock.calls[0] as [string, string];
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('использует первые 300 символов контента если нет summary', async () => {
      const longContent = 'A'.repeat(500);
      const article = makeArticle({
        summary: null,
        content: longContent,
        source: makeSource(SourceType.RSS),
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '42' }]);
      mockPrisma.userArticle.findMany.mockResolvedValue([makeUserArticle({ article })]);

      await service.notifyAll();

      const [, html] = (mockBot.sendMessage as jest.Mock).mock.calls[0] as [string, string];
      expect(html).toContain('A'.repeat(300));
      expect(html).toContain('…');
    });
  });

  describe('Telegram-пост', () => {
    it('пересылает сообщение по username канала и ID', async () => {
      const article = makeArticle({
        url: 'https://t.me/testchannel/42',
        source: makeSource(SourceType.TELEGRAM),
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '99' }]);
      mockPrisma.userArticle.findMany.mockResolvedValue([makeUserArticle({ article })]);

      await service.notifyAll();

      expect(mockBot.forwardMessage).toHaveBeenCalledWith('99', '@testchannel', 42);
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('отправляет ссылкой если forwardMessage выбросил ошибку (приватный канал)', async () => {
      const article = makeArticle({
        url: 'https://t.me/privatechannel/7',
        title: 'Private Post',
        source: makeSource(SourceType.TELEGRAM),
      });
      mockBot.forwardMessage.mockRejectedValue(new Error('Bad Request'));
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '99' }]);
      mockPrisma.userArticle.findMany.mockResolvedValue([makeUserArticle({ article })]);

      await service.notifyAll();

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '99',
        expect.stringContaining('Private Post'),
      );
    });
  });

  describe('отметка об отправке', () => {
    it('помечает статью как отправленную после успешной отправки', async () => {
      const ua = makeUserArticle({
        id: 'ua-42',
        article: makeArticle({ source: makeSource(SourceType.RSS) }),
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '1' }]);
      mockPrisma.userArticle.findMany.mockResolvedValue([ua]);

      await service.notifyAll();

      expect(mockPrisma.userArticle.update).toHaveBeenCalledWith({
        where: { id: 'ua-42' },
        data: { telegramNotifiedAt: expect.any(Date) },
      });
    });

    it('не помечает статью если отправка упала (попробуем снова в следующем цикле)', async () => {
      const ua = makeUserArticle({ article: makeArticle({ source: makeSource(SourceType.RSS) }) });
      mockBot.sendMessage.mockRejectedValue(new Error('Telegram error'));
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '1' }]);
      mockPrisma.userArticle.findMany.mockResolvedValue([ua]);

      await service.notifyAll();

      expect(mockPrisma.userArticle.update).not.toHaveBeenCalled();
    });
  });

  describe('порог релевантности', () => {
    it('использует дефолтный порог 0.6 если нет настроек', async () => {
      mockPrisma.userPreferences.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '1' }]);

      await service.notifyAll();

      expect(mockPrisma.userArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ score: { gte: 0.6 } }),
        }),
      );
    });

    it('применяет пользовательский порог из настроек', async () => {
      const prefs = { settings: { relevanceThreshold: 0.8 } } as unknown as UserPreferences;
      mockPrisma.userPreferences.findFirst.mockResolvedValue(prefs);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', telegramChatId: '1' }]);

      await service.notifyAll();

      expect(mockPrisma.userArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ score: { gte: 0.8 } }),
        }),
      );
    });
  });
});
