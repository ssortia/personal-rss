import type { Article } from '@prisma/client';
import { SourceType } from '@prisma/client';

import { ArticlesRepository } from '../articles/articles.repository';
import { PreferencesRepository } from '../preferences/preferences.repository';

import type { AiGateway } from './ai-gateway.interface';
import { ArticlesScoringService } from './articles-scoring.service';
import type { ScoringService } from './scoring.service';

// Нулевые задержки чтобы тесты не зависали
jest.mock('../config/env', () => ({
  getEnv: () => ({
    GROQ_BATCH_SIZE: 5,
    GROQ_BATCH_DELAY_MS: 0,
    // Высокий TPM-лимит → minDelayForTpm ≈ 0
    GROQ_TPM_LIMIT: 6_000_000,
  }),
}));

const makeArticle = (id: string): Article =>
  ({
    id,
    title: `Article ${id}`,
    content: `Content of ${id}`,
    url: `https://example.com/${id}`,
    guid: `guid-${id}`,
    sourceId: 'source-1',
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    summary: null,
    aiTitle: null,
  }) as unknown as Article;

describe('ArticlesScoringService', () => {
  let service: ArticlesScoringService;
  let mockGateway: { isAvailable: boolean };
  let mockScoring: jest.Mocked<Pick<ScoringService, 'scoreBatch'>>;
  let mockArticlesRepo: jest.Mocked<
    Pick<ArticlesRepository, 'findUnscoredBySource' | 'upsertUserArticle' | 'updateAiContentBatch'>
  >;
  let mockPrefsRepo: jest.Mocked<Pick<PreferencesRepository, 'getSettings'>>;

  beforeEach(() => {
    jest.useFakeTimers();
    // Устраняем jitter: Math.random() = 0 → jitterMs = 0
    jest.spyOn(Math, 'random').mockReturnValue(0);

    mockGateway = { isAvailable: true };

    mockScoring = {
      scoreBatch: jest.fn().mockResolvedValue([]),
    };

    mockArticlesRepo = {
      findUnscoredBySource: jest.fn().mockResolvedValue([]),
      upsertUserArticle: jest.fn().mockResolvedValue(undefined),
      updateAiContentBatch: jest.fn().mockResolvedValue(undefined),
    };

    mockPrefsRepo = {
      getSettings: jest.fn().mockResolvedValue({
        relevanceThreshold: 0.6,
        selectedCategories: ['tech'],
        interestsText: null,
      }),
    };

    service = new ArticlesScoringService(
      mockScoring as unknown as ScoringService,
      mockArticlesRepo as unknown as ArticlesRepository,
      mockPrefsRepo as unknown as PreferencesRepository,
      mockGateway as unknown as AiGateway,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('когда AI недоступен', () => {
    it('немедленно возвращает без обращения к репозиторию', async () => {
      mockGateway.isAvailable = false;
      const promise = service.scoreForUser('user-1', 'source-1', SourceType.RSS);
      await jest.runAllTimersAsync();
      await promise;
      expect(mockArticlesRepo.findUnscoredBySource).not.toHaveBeenCalled();
    });
  });

  describe('когда нет неоценённых статей', () => {
    it('немедленно возвращает без вызова scoreBatch', async () => {
      mockArticlesRepo.findUnscoredBySource.mockResolvedValue([]);
      const promise = service.scoreForUser('user-1', 'source-1', SourceType.RSS);
      await jest.runAllTimersAsync();
      await promise;
      expect(mockScoring.scoreBatch).not.toHaveBeenCalled();
    });
  });

  describe('обработка статей', () => {
    it('вызывает upsertUserArticle для каждой статьи в батче', async () => {
      const articles = [makeArticle('a1'), makeArticle('a2')];
      mockArticlesRepo.findUnscoredBySource.mockResolvedValue(articles);
      mockScoring.scoreBatch.mockResolvedValue([
        { score: 0.8, reason: 'Good', aiContent: null },
        { score: 0.3, reason: 'Low', aiContent: null },
      ]);

      const promise = service.scoreForUser('user-1', 'source-1', SourceType.RSS);
      await jest.runAllTimersAsync();
      await promise;

      expect(mockArticlesRepo.upsertUserArticle).toHaveBeenCalledWith('user-1', 'a1', 0.8, 'Good');
      expect(mockArticlesRepo.upsertUserArticle).toHaveBeenCalledWith('user-1', 'a2', 0.3, 'Low');
    });

    it('вызывает updateAiContentBatch только для статей с непустым aiContent', async () => {
      const articles = [makeArticle('a1'), makeArticle('a2'), makeArticle('a3')];
      mockArticlesRepo.findUnscoredBySource.mockResolvedValue(articles);
      mockScoring.scoreBatch.mockResolvedValue([
        { score: 0.8, reason: null, aiContent: 'Summary A1' },
        { score: 0.5, reason: null, aiContent: null }, // без aiContent
        { score: 0.7, reason: null, aiContent: 'Summary A3' },
      ]);

      const promise = service.scoreForUser('user-1', 'source-1', SourceType.RSS);
      await jest.runAllTimersAsync();
      await promise;

      expect(mockArticlesRepo.updateAiContentBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ articleId: 'a1', aiContent: 'Summary A1' }),
          expect.objectContaining({ articleId: 'a3', aiContent: 'Summary A3' }),
        ]),
      );
      // Статья a2 (aiContent = null) не должна быть в batch
      const callArg = (mockArticlesRepo.updateAiContentBatch as jest.Mock).mock
        .calls[0][0] as Array<{ articleId: string }>;
      expect(callArg).not.toContainEqual(expect.objectContaining({ articleId: 'a2' }));
    });

    it('ошибка upsertUserArticle одной статьи не прерывает остальные', async () => {
      const articles = [makeArticle('a1'), makeArticle('a2')];
      mockArticlesRepo.findUnscoredBySource.mockResolvedValue(articles);
      mockScoring.scoreBatch.mockResolvedValue([
        { score: 0.8, reason: null, aiContent: null },
        { score: 0.5, reason: null, aiContent: null },
      ]);

      // Первая статья падает при сохранении
      (mockArticlesRepo.upsertUserArticle as jest.Mock)
        .mockRejectedValueOnce(new Error('DB constraint error'))
        .mockResolvedValueOnce(undefined);

      const promise = service.scoreForUser('user-1', 'source-1', SourceType.RSS);
      await jest.runAllTimersAsync();
      await promise;

      // Вторая статья всё равно должна быть обработана
      expect(mockArticlesRepo.upsertUserArticle).toHaveBeenCalledTimes(2);
    });

    it('разбивает статьи на батчи по GROQ_BATCH_SIZE и вызывает scoreBatch для каждого', async () => {
      // GROQ_BATCH_SIZE=5, создаём 7 статей → 2 батча: [a1..a5] и [a6, a7]
      const articles = Array.from({ length: 7 }, (_, i) => makeArticle(`a${i + 1}`));
      mockArticlesRepo.findUnscoredBySource.mockResolvedValue(articles);
      mockScoring.scoreBatch
        .mockResolvedValueOnce(Array(5).fill({ score: 0.5, reason: null, aiContent: null }))
        .mockResolvedValueOnce(Array(2).fill({ score: 0.5, reason: null, aiContent: null }));

      const promise = service.scoreForUser('user-1', 'source-1', SourceType.RSS);
      await jest.runAllTimersAsync();
      await promise;

      expect(mockScoring.scoreBatch).toHaveBeenCalledTimes(2);
      // Первый батч — 5 статей
      expect((mockScoring.scoreBatch as jest.Mock).mock.calls[0][0]).toHaveLength(5);
      // Второй батч — 2 статьи
      expect((mockScoring.scoreBatch as jest.Mock).mock.calls[1][0]).toHaveLength(2);
      // upsertUserArticle вызван для всех 7 статей
      expect(mockArticlesRepo.upsertUserArticle).toHaveBeenCalledTimes(7);
    });

    it('передаёт selectedCategories и interestsText в scoreBatch', async () => {
      mockArticlesRepo.findUnscoredBySource.mockResolvedValue([makeArticle('a1')]);
      mockPrefsRepo.getSettings.mockResolvedValue({
        relevanceThreshold: 0.5,
        selectedCategories: ['tech', 'science'],
        interestsText: 'AI and robotics',
      });
      mockScoring.scoreBatch.mockResolvedValue([{ score: 0.7, reason: null, aiContent: null }]);

      const promise = service.scoreForUser('user-1', 'source-1', SourceType.RSS);
      await jest.runAllTimersAsync();
      await promise;

      expect(mockScoring.scoreBatch).toHaveBeenCalledWith(
        expect.any(Array),
        ['tech', 'science'],
        'AI and robotics',
      );
    });
  });
});
