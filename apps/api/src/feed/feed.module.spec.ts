import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient, User } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

import { ArticlesRepository } from '../articles/articles.repository';
import { PreferencesRepository } from '../preferences/preferences.repository';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';

import { FeedService } from './feed.service';

const makeFeedItem = (overrides: { url: string; title?: string; publishedAt?: Date | null }) => ({
  id: 'a1',
  title: overrides.title ?? 'Test Article',
  content: null,
  summary: null,
  aiTitle: null,
  sourceType: 'RSS' as const,
  publishedAt:
    overrides.publishedAt !== undefined ? overrides.publishedAt : new Date('2024-01-15T12:00:00Z'),
  score: null,
  source: { id: 'source-1', title: 'Example Source' },
  url: overrides.url,
});

const baseUser: User = {
  id: 'user-1',
  email: 'feed@example.com',
  password: 'hashed',
  role: 'USER',
  refreshToken: null,
  resetToken: null,
  resetTokenExpiresAt: null,
  feedToken: 'valid-feed-token',
  telegramChatId: null,
  telegramUsername: null,
  telegramLinkToken: null,
  telegramLinkTokenExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('FeedModule (module)', () => {
  let feedService: FeedService;
  let prisma: ReturnType<typeof mockDeep<PrismaClient>>;
  let mockArticlesRepo: ReturnType<typeof mockDeep<ArticlesRepository>>;
  let mockPrefsRepo: ReturnType<typeof mockDeep<PreferencesRepository>>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    mockArticlesRepo = mockDeep<ArticlesRepository>();
    mockPrefsRepo = mockDeep<PreferencesRepository>();

    // Дефолтные ответы — переопределяются в конкретных тестах
    mockArticlesRepo.getFeed.mockResolvedValue({ items: [], nextCursor: null });
    mockPrefsRepo.getSettings.mockResolvedValue({
      relevanceThreshold: 0.6,
      selectedCategories: [],
      interestsText: null,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        FeedService,
        UsersService,
        UsersRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: ArticlesRepository, useValue: mockArticlesRepo },
        { provide: PreferencesRepository, useValue: mockPrefsRepo },
      ],
    }).compile();

    feedService = moduleRef.get(FeedService);
  });

  describe('getRssFeed', () => {
    it('бросает NotFoundException если токен не найден — проходит через DI-цепочку до Prisma', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(feedService.getRssFeed('invalid-token')).rejects.toThrow(NotFoundException);

      // FeedService→UsersService→UsersRepository→prisma.user.findUnique
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { feedToken: 'invalid-token' } }),
      );
    });

    it('строит корректный RSS XML если токен валиден', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const xml = await feedService.getRssFeed('valid-feed-token');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { feedToken: 'valid-feed-token' } }),
      );
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<rss version="2.0">');
      expect(xml).toContain('feed@example.com');
    });

    it('передаёт relevanceThreshold из настроек в репозиторий статей', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      mockPrefsRepo.getSettings.mockResolvedValue({
        relevanceThreshold: 0.85,
        selectedCategories: [],
        interestsText: null,
      });

      await feedService.getRssFeed('valid-feed-token');

      expect(mockPrefsRepo.getSettings).toHaveBeenCalledWith('user-1');
      expect(mockArticlesRepo.getFeed).toHaveBeenCalledWith('user-1', 0.85, undefined, 50);
    });

    it('включает <item> в XML для каждой статьи из репозитория', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      mockArticlesRepo.getFeed.mockResolvedValue({
        items: [makeFeedItem({ url: 'https://example.com/article' })],
        nextCursor: null,
      });

      const xml = await feedService.getRssFeed('valid-feed-token');

      expect(xml).toContain('<![CDATA[Test Article]]>');
      expect(xml).toContain('https://example.com/article');
      // source.title не оборачивается в CDATA — используется escapeXml
      expect(xml).toContain('>Example Source</source>');
    });

    it('экранирует спецсимволы XML в URL статьи', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      mockArticlesRepo.getFeed.mockResolvedValue({
        items: [makeFeedItem({ url: 'https://example.com/article?a=1&b=2', publishedAt: null })],
        nextCursor: null,
      });

      const xml = await feedService.getRssFeed('valid-feed-token');

      expect(xml).toContain('https://example.com/article?a=1&amp;b=2');
      expect(xml).not.toContain('a=1&b=2'); // не должно быть неэкранированного &
    });
  });

  describe('getToken', () => {
    it('возвращает существующий feedToken из БД через DI-цепочку', async () => {
      // UsersService.getFeedToken → UsersRepository.findById → prisma.user.findUnique
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await feedService.getToken('user-1');

      expect(result).toEqual({ token: 'valid-feed-token' });
    });

    it('генерирует и сохраняет новый feedToken если у пользователя его нет', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, feedToken: null });
      prisma.user.update.mockResolvedValue(baseUser);

      const result = await feedService.getToken('user-1');

      // randomBytes(32).toString('hex') даёт 64-символьный hex-токен
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            feedToken: expect.stringMatching(/^[0-9a-f]{64}$/),
          }),
        }),
      );
      expect(result.token).toBeTruthy();
    });
  });
});
