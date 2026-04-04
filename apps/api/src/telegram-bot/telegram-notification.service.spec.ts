import type { Article, Source, UserArticle } from '@prisma/client';
import { SourceType } from '@prisma/client';

// p-limit v5+ использует ESM — мокируем чтобы избежать SyntaxError в Jest
jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => Promise<unknown>) => fn(),
}));

import type { ArticlesRepository } from '../articles/articles.repository';
import type { PreferencesRepository } from '../preferences/preferences.repository';
import type { UsersRepository } from '../users/users.repository';

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

describe('TelegramNotificationService', () => {
  let service: TelegramNotificationService;
  let mockBot: jest.Mocked<Pick<TelegramBotService, 'isReady' | 'sendMessage' | 'forwardMessage'>>;
  let mockUsersRepo: jest.Mocked<Pick<UsersRepository, 'findWithTelegramChatId'>>;
  let mockArticlesRepo: jest.Mocked<
    Pick<ArticlesRepository, 'findPendingTelegramNotifications' | 'markTelegramNotified'>
  >;
  let mockPrefsRepo: jest.Mocked<Pick<PreferencesRepository, 'getSettings'>>;

  beforeEach(() => {
    mockBot = {
      isReady: jest.fn().mockReturnValue(true),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      forwardMessage: jest.fn().mockResolvedValue(undefined),
    };

    mockUsersRepo = {
      findWithTelegramChatId: jest.fn().mockResolvedValue([]),
    };

    mockArticlesRepo = {
      findPendingTelegramNotifications: jest.fn().mockResolvedValue([]),
      markTelegramNotified: jest.fn().mockResolvedValue(undefined),
    };

    mockPrefsRepo = {
      getSettings: jest.fn().mockResolvedValue({ relevanceThreshold: 0.75 }),
    };

    service = new TelegramNotificationService(
      mockBot as unknown as TelegramBotService,
      mockUsersRepo as unknown as UsersRepository,
      mockArticlesRepo as unknown as ArticlesRepository,
      mockPrefsRepo as unknown as PreferencesRepository,
    );
  });

  describe('notifyAll', () => {
    it('ничего не делает если бот не готов', async () => {
      mockBot.isReady.mockReturnValue(false);
      await service.notifyAll();
      expect(mockUsersRepo.findWithTelegramChatId).not.toHaveBeenCalled();
    });

    it('ничего не делает если нет пользователей с привязанным Telegram', async () => {
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([]);
      await service.notifyAll();
      expect(mockArticlesRepo.findPendingTelegramNotifications).not.toHaveBeenCalled();
    });

    it('запрашивает статьи только для пользователей с telegramChatId', async () => {
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '12345' },
      ]);
      await service.notifyAll();
      expect(mockArticlesRepo.findPendingTelegramNotifications).toHaveBeenCalledWith(
        'user-1',
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('не запускает второй цикл если первый ещё не завершился', async () => {
      let resolveFirst!: () => void;
      const firstCycleBlocked = new Promise<void>((res) => {
        resolveFirst = res;
      });
      mockUsersRepo.findWithTelegramChatId.mockImplementation(() =>
        firstCycleBlocked.then(() => []),
      );

      const first = service.notifyAll();
      // Второй вызов должен выйти сразу — isRunning = true
      await service.notifyAll();
      expect(mockUsersRepo.findWithTelegramChatId).toHaveBeenCalledTimes(1);

      resolveFirst();
      await first;
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
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '42' },
      ]);
      mockArticlesRepo.findPendingTelegramNotifications.mockResolvedValue([
        makeUserArticle({ article }),
      ]);

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
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '42' },
      ]);
      mockArticlesRepo.findPendingTelegramNotifications.mockResolvedValue([
        makeUserArticle({ article }),
      ]);

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
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '42' },
      ]);
      mockArticlesRepo.findPendingTelegramNotifications.mockResolvedValue([
        makeUserArticle({ article }),
      ]);

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
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '99' },
      ]);
      mockArticlesRepo.findPendingTelegramNotifications.mockResolvedValue([
        makeUserArticle({ article }),
      ]);

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
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '99' },
      ]);
      mockArticlesRepo.findPendingTelegramNotifications.mockResolvedValue([
        makeUserArticle({ article }),
      ]);

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
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '1' },
      ]);
      mockArticlesRepo.findPendingTelegramNotifications.mockResolvedValue([ua]);

      await service.notifyAll();

      expect(mockArticlesRepo.markTelegramNotified).toHaveBeenCalledWith('ua-42');
    });

    it('не помечает статью если отправка упала (попробуем снова в следующем цикле)', async () => {
      const ua = makeUserArticle({ article: makeArticle({ source: makeSource(SourceType.RSS) }) });
      mockBot.sendMessage.mockRejectedValue(new Error('Telegram error'));
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '1' },
      ]);
      mockArticlesRepo.findPendingTelegramNotifications.mockResolvedValue([ua]);

      await service.notifyAll();

      expect(mockArticlesRepo.markTelegramNotified).not.toHaveBeenCalled();
    });
  });

  describe('порог релевантности', () => {
    it('использует дефолтный порог 0.75 если нет настроек', async () => {
      mockPrefsRepo.getSettings.mockResolvedValue({
        relevanceThreshold: 0.75,
        interestsText: null,
        selectedCategories: [],
      });
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '1' },
      ]);

      await service.notifyAll();

      expect(mockArticlesRepo.findPendingTelegramNotifications).toHaveBeenCalledWith(
        'user-1',
        0.75,
        expect.any(Number),
      );
    });

    it('применяет пользовательский порог из настроек', async () => {
      mockPrefsRepo.getSettings.mockResolvedValue({
        relevanceThreshold: 0.8,
        interestsText: null,
        selectedCategories: [],
      });
      mockUsersRepo.findWithTelegramChatId.mockResolvedValue([
        { id: 'user-1', telegramChatId: '1' },
      ]);

      await service.notifyAll();

      expect(mockArticlesRepo.findPendingTelegramNotifications).toHaveBeenCalledWith(
        'user-1',
        0.8,
        expect.any(Number),
      );
    });
  });
});
