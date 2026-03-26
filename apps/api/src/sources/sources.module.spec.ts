import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient, Source, UserSource } from '@prisma/client';
import { SourceType } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

import { ArticlesRepository } from '../articles/articles.repository';
import { PrismaService } from '../prisma/prisma.service';
import { ArticlesScoringService } from '../scoring/articles-scoring.service';
import { TelegramGate } from '../telegram/telegram.gate';

import { SourcesRepository } from './sources.repository';
import { SourcesService } from './sources.service';

jest.mock('rss-parser', () =>
  jest.fn().mockImplementation(() => ({
    parseURL: jest.fn().mockResolvedValue({
      title: 'Test Feed',
      description: 'Test feed description',
      image: null,
      items: [],
    }),
  })),
);

const baseSource: Source = {
  id: 'source-1',
  url: 'https://example.com/feed',
  type: SourceType.RSS,
  title: 'Test Feed',
  description: null,
  imageUrl: null,
  lastFetchAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseUserSource: UserSource = {
  id: 'usersource-1',
  userId: 'user-1',
  sourceId: 'source-1',
  isActive: true,
  createdAt: new Date(),
};

describe('SourcesModule (module)', () => {
  let sourcesService: SourcesService;
  let prisma: ReturnType<typeof mockDeep<PrismaClient>>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        SourcesService,
        SourcesRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: ArticlesRepository, useValue: { upsertMany: jest.fn() } },
        { provide: ArticlesScoringService, useValue: { scoreForUser: jest.fn() } },
        { provide: TelegramGate, useValue: { fetchChannel: jest.fn() } },
      ],
    }).compile();

    sourcesService = moduleRef.get(SourcesService);
  });

  describe('getUserSources', () => {
    it('возвращает список источников пользователя через SourcesRepository→Prisma', async () => {
      prisma.userSource.findMany.mockResolvedValue([
        { ...baseUserSource, source: baseSource } as any,
      ]);

      const result = await sourcesService.getUserSources('user-1');

      expect(prisma.userSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('source');
    });
  });

  describe('addSource (RSS)', () => {
    it('создаёт источник и подписку если они не существуют', async () => {
      prisma.source.upsert.mockResolvedValue(baseSource);
      prisma.userSource.findUnique.mockResolvedValue(null); // подписки ещё нет
      prisma.userSource.create.mockResolvedValue(baseUserSource);
      prisma.userSource.findMany.mockResolvedValue([
        { ...baseUserSource, source: baseSource } as any,
      ]);
      prisma.source.update.mockResolvedValue(baseSource); // updateLastFetchAt

      const result = await sourcesService.addSource('user-1', 'https://example.com/feed');

      expect(prisma.source.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { url: 'https://example.com/feed' } }),
      );
      expect(prisma.userSource.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1', sourceId: 'source-1' }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('бросает ConflictException если подписка уже существует', async () => {
      prisma.source.upsert.mockResolvedValue(baseSource);
      prisma.userSource.findUnique.mockResolvedValue(baseUserSource); // уже подписан

      await expect(sourcesService.addSource('user-1', 'https://example.com/feed')).rejects.toThrow(
        ConflictException,
      );

      expect(prisma.userSource.create).not.toHaveBeenCalled();
    });
  });

  describe('removeSource', () => {
    it('удаляет подписку через prisma.userSource.delete', async () => {
      prisma.userSource.findUnique.mockResolvedValue(baseUserSource);
      prisma.userSource.delete.mockResolvedValue(baseUserSource);

      await sourcesService.removeSource('user-1', 'source-1');

      expect(prisma.userSource.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_sourceId: { userId: 'user-1', sourceId: 'source-1' } },
        }),
      );
    });

    it('бросает NotFoundException если подписка не найдена', async () => {
      prisma.userSource.findUnique.mockResolvedValue(null);

      await expect(sourcesService.removeSource('user-1', 'unknown-source')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.userSource.delete).not.toHaveBeenCalled();
    });
  });

  describe('toggleSource', () => {
    it('переключает isActive через prisma.userSource.update', async () => {
      prisma.userSource.findUnique.mockResolvedValue(baseUserSource);
      prisma.userSource.update.mockResolvedValue({ ...baseUserSource, isActive: false });

      await sourcesService.toggleSource('user-1', 'source-1', false);

      expect(prisma.userSource.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_sourceId: { userId: 'user-1', sourceId: 'source-1' } },
          data: { isActive: false },
        }),
      );
    });

    it('бросает NotFoundException если подписка не найдена', async () => {
      prisma.userSource.findUnique.mockResolvedValue(null);

      await expect(sourcesService.toggleSource('user-1', 'unknown', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
