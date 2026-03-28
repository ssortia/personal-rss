import { NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { SourceType } from '@prisma/client';
import type { ArticleFeedItem } from '@repo/shared';

import { ArticlesRepository } from '../articles/articles.repository';
import { PreferencesRepository } from '../preferences/preferences.repository';
import { UsersService } from '../users/users.service';

import { FeedService } from './feed.service';

jest.mock('@repo/shared', () => ({
  ...jest.requireActual('@repo/shared'),
  APP_NAME: 'TestApp',
}));

const baseUser: User = {
  id: 'user-1',
  email: 'user@example.com',
  password: 'hashed',
  role: 'USER',
  refreshToken: null,
  resetToken: null,
  resetTokenExpiresAt: null,
  feedToken: 'feed-token-abc',
  telegramChatId: null,
  telegramUsername: null,
  telegramLinkToken: null,
  telegramLinkTokenExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeFeedItem = (override: Partial<ArticleFeedItem> = {}): ArticleFeedItem => ({
  id: 'article-1',
  title: 'Test Article',
  url: 'https://example.com/article',
  content: 'Article content',
  summary: null,
  aiTitle: null,
  sourceType: SourceType.RSS,
  publishedAt: new Date('2024-01-01T00:00:00Z'),
  score: 0.8,
  source: { id: 'source-1', title: 'Test Source' },
  ...override,
});

describe('FeedService', () => {
  let service: FeedService;
  let mockUsers: jest.Mocked<
    Pick<UsersService, 'getFeedToken' | 'resetFeedToken' | 'findByFeedToken'>
  >;
  let mockArticlesRepo: jest.Mocked<Pick<ArticlesRepository, 'getFeed'>>;
  let mockPrefsRepo: jest.Mocked<Pick<PreferencesRepository, 'getSettings'>>;

  beforeEach(() => {
    mockUsers = {
      getFeedToken: jest.fn().mockResolvedValue('token-123'),
      resetFeedToken: jest.fn().mockResolvedValue('token-new'),
      findByFeedToken: jest.fn().mockResolvedValue(baseUser),
    };

    mockArticlesRepo = {
      getFeed: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };

    mockPrefsRepo = {
      getSettings: jest.fn().mockResolvedValue({
        relevanceThreshold: 0.6,
        selectedCategories: [],
        interestsText: null,
      }),
    };

    service = new FeedService(
      mockUsers as unknown as UsersService,
      mockArticlesRepo as unknown as ArticlesRepository,
      mockPrefsRepo as unknown as PreferencesRepository,
    );
  });

  describe('getToken', () => {
    it('возвращает объект с токеном', async () => {
      const result = await service.getToken('user-1');
      expect(result).toEqual({ token: 'token-123' });
      expect(mockUsers.getFeedToken).toHaveBeenCalledWith('user-1');
    });
  });

  describe('resetToken', () => {
    it('сбрасывает и возвращает новый токен', async () => {
      const result = await service.resetToken('user-1');
      expect(result).toEqual({ token: 'token-new' });
      expect(mockUsers.resetFeedToken).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getRssFeed', () => {
    it('бросает NotFoundException если пользователь не найден по токену', async () => {
      mockUsers.findByFeedToken.mockResolvedValue(null);
      await expect(service.getRssFeed('invalid-token')).rejects.toThrow(NotFoundException);
    });

    it('возвращает валидный RSS 2.0 XML', async () => {
      const result = await service.getRssFeed('feed-token-abc');
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<rss version="2.0">');
      expect(result).toContain('<channel>');
      expect(result).toContain('</channel>');
      expect(result).toContain('</rss>');
    });

    it('включает email пользователя в заголовок канала', async () => {
      const result = await service.getRssFeed('feed-token-abc');
      expect(result).toContain('user@example.com');
      expect(result).toContain('TestApp');
    });

    it('использует relevanceThreshold из настроек', async () => {
      mockPrefsRepo.getSettings.mockResolvedValue({
        relevanceThreshold: 0.8,
        selectedCategories: [],
        interestsText: null,
      });
      await service.getRssFeed('feed-token-abc');
      expect(mockArticlesRepo.getFeed).toHaveBeenCalledWith('user-1', 0.8, undefined, 50);
    });

    it('генерирует <item> для каждой статьи', async () => {
      mockArticlesRepo.getFeed.mockResolvedValue({
        items: [makeFeedItem(), makeFeedItem({ id: 'article-2', title: 'Second Article' })],
        nextCursor: null,
      });
      const result = await service.getRssFeed('feed-token-abc');
      const itemCount = (result.match(/<item>/g) ?? []).length;
      expect(itemCount).toBe(2);
    });

    it('содержит title в CDATA и link/guid статьи', async () => {
      mockArticlesRepo.getFeed.mockResolvedValue({
        items: [makeFeedItem()],
        nextCursor: null,
      });
      const result = await service.getRssFeed('feed-token-abc');
      expect(result).toContain('<![CDATA[Test Article]]>');
      expect(result).toContain('<link>https://example.com/article</link>');
      expect(result).toContain('<guid>https://example.com/article</guid>');
    });

    it('включает pubDate если publishedAt задан', async () => {
      mockArticlesRepo.getFeed.mockResolvedValue({
        items: [makeFeedItem({ publishedAt: new Date('2024-01-15T10:00:00Z') })],
        nextCursor: null,
      });
      const result = await service.getRssFeed('feed-token-abc');
      expect(result).toContain('<pubDate>');
    });

    it('не включает pubDate если publishedAt равен null', async () => {
      mockArticlesRepo.getFeed.mockResolvedValue({
        items: [makeFeedItem({ publishedAt: null })],
        nextCursor: null,
      });
      const result = await service.getRssFeed('feed-token-abc');
      expect(result).not.toContain('<pubDate>');
    });

    describe('экранирование XML (escapeXml)', () => {
      it('экранирует & в URL', async () => {
        mockArticlesRepo.getFeed.mockResolvedValue({
          items: [makeFeedItem({ url: 'https://example.com?a=1&b=2' })],
          nextCursor: null,
        });
        const result = await service.getRssFeed('feed-token-abc');
        expect(result).toContain('https://example.com?a=1&amp;b=2');
        expect(result).not.toContain('a=1&b=2');
      });

      it('экранирует < и > в названии источника', async () => {
        mockArticlesRepo.getFeed.mockResolvedValue({
          items: [makeFeedItem({ source: { id: 'src', title: 'Source <test> channel' } })],
          nextCursor: null,
        });
        const result = await service.getRssFeed('feed-token-abc');
        expect(result).toContain('Source &lt;test&gt; channel');
      });

      it('экранирует кавычки в URL', async () => {
        mockArticlesRepo.getFeed.mockResolvedValue({
          items: [makeFeedItem({ url: 'https://example.com/path?q="search"' })],
          nextCursor: null,
        });
        const result = await service.getRssFeed('feed-token-abc');
        expect(result).toContain('&quot;search&quot;');
      });
    });
  });
});
