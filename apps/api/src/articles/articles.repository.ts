import { Injectable } from '@nestjs/common';
import type { Article } from '@prisma/client';
import type { Item } from 'rss-parser';

import type { ArticleFeedItem, FeedPage } from '@repo/types';

import { PrismaService } from '../prisma/prisma.service';

interface FeedCursor {
  publishedAt: string | null;
  id: string;
}

function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

function decodeCursor(raw: string): FeedCursor {
  return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) as FeedCursor;
}

@Injectable()
export class ArticlesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Сохраняет статьи из RSS-фида, пропуская уже существующие (по sourceId + guid). */
  async upsertMany(sourceId: string, items: Item[]): Promise<void> {
    const data = items
      .filter((item) => item.title) // пропускаем элементы без заголовка
      .map((item) => ({
        sourceId,
        guid: item.guid ?? item.link ?? item.title ?? '',
        title: item.title ?? '',
        url: item.link ?? '',
        content:
          item.contentSnippet ?? ((item as Record<string, unknown>)['content'] as string) ?? null,
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      }))
      .filter((a) => a.guid); // исключаем статьи без идентификатора

    if (data.length === 0) return;

    await this.prisma.article.createMany({ data, skipDuplicates: true });
  }

  /** Возвращает последние N статей источника (по умолчанию 50). */
  findBySource(sourceId: string, limit = 50): Promise<Article[]> {
    return this.prisma.article.findMany({
      where: { sourceId },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Возвращает страницу фида для пользователя.
   * Включает статьи из активных источников с оценкой >= threshold или ещё не оценённые.
   * Порядок: publishedAt DESC NULLS LAST, id DESC. Cursor-based пагинация.
   */
  async getFeed(
    userId: string,
    threshold: number,
    cursorRaw?: string,
    limit = 20,
  ): Promise<FeedPage> {
    const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;

    // WHERE-условие для курсора: «статьи старше последней виденной»
    const cursorWhere = cursor
      ? cursor.publishedAt !== null
        ? {
            OR: [
              { publishedAt: { lt: new Date(cursor.publishedAt) } },
              { publishedAt: new Date(cursor.publishedAt), id: { lt: cursor.id } },
              { publishedAt: null },
            ],
          }
        : { publishedAt: null, id: { lt: cursor.id } }
      : undefined;

    const rows = await this.prisma.article.findMany({
      where: {
        AND: [
          // Только из активных источников пользователя
          { source: { userSources: { some: { userId, isActive: true } } } },
          { userArticles: { some: { userId, score: { gte: threshold } } } },
          ...(cursorWhere ? [cursorWhere] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        url: true,
        publishedAt: true,
        source: { select: { id: true, title: true } },
        userArticles: {
          where: { userId },
          select: { score: true },
          take: 1,
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasNext = rows.length > limit;
    const items = rows.slice(0, limit);

    const feedItems: ArticleFeedItem[] = items.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      publishedAt: row.publishedAt,
      score: row.userArticles[0]?.score ?? null,
      source: row.source,
    }));

    const lastItem = items.at(-1);
    const nextCursor =
      hasNext && lastItem
        ? encodeCursor({
            publishedAt: lastItem.publishedAt?.toISOString() ?? null,
            id: lastItem.id,
          })
        : null;

    return { items: feedItems, nextCursor };
  }

  /** Сохраняет или обновляет персональную оценку статьи для пользователя. */
  async upsertUserArticle(
    userId: string,
    articleId: string,
    score: number,
    reason: string | null,
  ): Promise<void> {
    await this.prisma.userArticle.upsert({
      where: { userId_articleId: { userId, articleId } },
      create: { userId, articleId, score, scoreReason: reason },
      update: { score, scoreReason: reason },
    });
  }
}
