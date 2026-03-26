import type { Source } from '@prisma/client';
import { SourceType } from '@prisma/client';

import { ArticlesRepository } from '../articles/articles.repository';
import { ArticlesScoringService } from '../scoring/articles-scoring.service';
import { SourcesRepository } from '../sources/sources.repository';
import { TelegramGate } from '../telegram/telegram.gate';

import { SyncService } from './sync.service';

jest.mock('../config/env', () => ({
  getEnv: () => ({ FEED_SYNC_INTERVAL_MIN: 30 }),
}));

// p-limit v5+ использует ESM — мокируем чтобы избежать SyntaxError в Jest
jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => Promise<unknown>) => fn(),
}));

// Вспомогательная фабрика Telegram-источника (не требует мока rss-parser)
const makeTelegramSource = (id: string): Source =>
  ({
    id,
    type: SourceType.TELEGRAM,
    url: `https://t.me/channel_${id}`,
    title: `Channel ${id}`,
    description: null,
    imageUrl: null,
    lastFetchAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as Source;

describe('SyncService', () => {
  let service: SyncService;
  let mockSourcesRepo: jest.Mocked<
    Pick<
      SourcesRepository,
      | 'findActiveSources'
      | 'findActiveUserSources'
      | 'findActiveUserIdsForSource'
      | 'updateLastFetchAt'
      | 'updateLastError'
    >
  >;
  let mockScoring: jest.Mocked<Pick<ArticlesScoringService, 'scoreForUser'>>;
  let mockArticlesRepo: jest.Mocked<Pick<ArticlesRepository, 'upsertMany'>>;
  let mockTelegram: jest.Mocked<Pick<TelegramGate, 'fetchChannel'>>;

  beforeEach(() => {
    jest.useFakeTimers();

    mockSourcesRepo = {
      findActiveSources: jest.fn().mockResolvedValue([]),
      findActiveUserSources: jest.fn().mockResolvedValue([]),
      findActiveUserIdsForSource: jest.fn().mockResolvedValue([]),
      updateLastFetchAt: jest.fn().mockResolvedValue(undefined),
      updateLastError: jest.fn().mockResolvedValue(undefined),
    };

    mockScoring = {
      scoreForUser: jest.fn().mockResolvedValue(undefined),
    };

    mockArticlesRepo = {
      upsertMany: jest.fn().mockResolvedValue(undefined),
    };

    mockTelegram = {
      fetchChannel: jest
        .fn()
        .mockResolvedValue({ title: 'Test Channel', posts: [], description: null, imageUrl: null }),
    };

    service = new SyncService(
      mockSourcesRepo as unknown as SourcesRepository,
      mockScoring as unknown as ArticlesScoringService,
      mockArticlesRepo as unknown as ArticlesRepository,
      mockTelegram as unknown as TelegramGate,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('syncAllSources', () => {
    it('немедленно возвращает если синхронизация уже запущена', async () => {
      (service as unknown as { isRunning: boolean }).isRunning = true;
      await service.syncAllSources();
      expect(mockSourcesRepo.findActiveSources).not.toHaveBeenCalled();
    });

    it('сбрасывает isRunning в false после успешного выполнения', async () => {
      const promise = service.syncAllSources();
      await jest.runAllTimersAsync();
      await promise;
      expect((service as unknown as { isRunning: boolean }).isRunning).toBe(false);
    });

    it('сбрасывает isRunning в false даже при ошибке findActiveSources', async () => {
      mockSourcesRepo.findActiveSources.mockRejectedValue(new Error('DB error'));
      const promise = service.syncAllSources();
      // Подключаем обработчик до await, чтобы не получить unhandledRejection
      const expectation = expect(promise).rejects.toThrow('DB error');
      await jest.runAllTimersAsync();
      await expectation;
      expect((service as unknown as { isRunning: boolean }).isRunning).toBe(false);
    });

    it('обходит все активные источники', async () => {
      const sources = [makeTelegramSource('s1'), makeTelegramSource('s2')];
      mockSourcesRepo.findActiveSources.mockResolvedValue(sources);
      mockSourcesRepo.findActiveUserIdsForSource.mockResolvedValue(['user-1']);

      const promise = service.syncAllSources();
      await jest.runAllTimersAsync();
      await promise;

      expect(mockTelegram.fetchChannel).toHaveBeenCalledTimes(2);
      expect(mockSourcesRepo.updateLastFetchAt).toHaveBeenCalledWith('s1');
      expect(mockSourcesRepo.updateLastFetchAt).toHaveBeenCalledWith('s2');
    });

    it('продолжает обход при ошибке одного источника', async () => {
      const sources = [makeTelegramSource('s1'), makeTelegramSource('s2')];
      mockSourcesRepo.findActiveSources.mockResolvedValue(sources);

      // Моканием по имени канала — источники запускаются параллельно,
      // поэтому порядок вызовов fetchChannel недетерминирован
      mockTelegram.fetchChannel.mockImplementation((username: string) => {
        if (username === 'channel_s1') return Promise.reject(new Error('Channel unavailable'));
        return Promise.resolve({ title: 'OK', posts: [], description: null, imageUrl: null });
      });

      mockSourcesRepo.findActiveUserIdsForSource.mockResolvedValue([]);

      const promise = service.syncAllSources();
      await jest.runAllTimersAsync();
      await promise;

      // Ошибка первого источника должна быть сохранена
      expect(mockSourcesRepo.updateLastError).toHaveBeenCalledWith('s1', 'Channel unavailable');
      // Второй источник успешно обработан (updateLastFetchAt вызван для s2)
      expect(mockSourcesRepo.updateLastFetchAt).toHaveBeenCalledWith('s2');
    });

    it('запускает AI-оценку для всех активных подписчиков источника', async () => {
      const source = makeTelegramSource('s1');
      mockSourcesRepo.findActiveSources.mockResolvedValue([source]);
      mockSourcesRepo.findActiveUserIdsForSource.mockResolvedValue(['user-a', 'user-b']);

      const promise = service.syncAllSources();
      await jest.runAllTimersAsync();
      await promise;

      expect(mockScoring.scoreForUser).toHaveBeenCalledWith('user-a', 's1', SourceType.TELEGRAM);
      expect(mockScoring.scoreForUser).toHaveBeenCalledWith('user-b', 's1', SourceType.TELEGRAM);
    });
  });

  describe('syncForUser', () => {
    it('обходит все активные источники пользователя', async () => {
      const sources = [makeTelegramSource('s1'), makeTelegramSource('s2')];
      mockSourcesRepo.findActiveUserSources.mockResolvedValue(
        sources.map(
          (source) =>
            ({
              source,
              userId: 'user-1',
              sourceId: source.id,
              isActive: true,
              createdAt: new Date(),
              id: source.id,
              keywords: [],
              excludeKeywords: [],
            }) as any,
        ),
      );

      const promise = service.syncForUser('user-1');
      await jest.runAllTimersAsync();
      await promise;

      expect(mockTelegram.fetchChannel).toHaveBeenCalledTimes(2);
      expect(mockScoring.scoreForUser).toHaveBeenCalledWith('user-1', 's1', SourceType.TELEGRAM);
      expect(mockScoring.scoreForUser).toHaveBeenCalledWith('user-1', 's2', SourceType.TELEGRAM);
    });

    it('сохраняет ошибку источника и продолжает остальные при сбое', async () => {
      const sources = [makeTelegramSource('s1'), makeTelegramSource('s2')];
      mockSourcesRepo.findActiveUserSources.mockResolvedValue(
        sources.map(
          (source) =>
            ({
              source,
              userId: 'user-1',
              sourceId: source.id,
              isActive: true,
              createdAt: new Date(),
              id: source.id,
              keywords: [],
              excludeKeywords: [],
            }) as any,
        ),
      );

      // Моканием по имени канала — источники запускаются параллельно,
      // поэтому порядок вызовов fetchChannel недетерминирован
      mockTelegram.fetchChannel.mockImplementation((username: string) => {
        if (username === 'channel_s1') return Promise.reject(new Error('Timeout'));
        return Promise.resolve({ title: 'OK', posts: [], description: null, imageUrl: null });
      });

      const promise = service.syncForUser('user-1');
      await jest.runAllTimersAsync();
      await promise;

      expect(mockSourcesRepo.updateLastError).toHaveBeenCalledWith('s1', 'Timeout');
      // Второй источник должен пройти успешно
      expect(mockScoring.scoreForUser).toHaveBeenCalledWith('user-1', 's2', SourceType.TELEGRAM);
    });
  });
});
