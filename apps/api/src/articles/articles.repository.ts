import { Injectable, Logger } from '@nestjs/common';
import type { Article, Prisma } from '@prisma/client';
import { SourceType } from '@prisma/client';
import type { ArticleFeedItem, FeedPage } from '@repo/shared';

import { FEED_DEFAULT_LIMIT } from '../config/constants';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Удаляет символы, запрещённые в PostgreSQL text-полях: null-байты (\u0000)
 * и суррогатные пары (\uD800–\uDFFF), которые не являются валидным UTF-8.
 */
function sanitizeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  // eslint-disable-next-line no-control-regex
  return value.replace(/\u0000/g, '').replace(/[\uD800-\uDFFF]/g, '');
}

/** Универсальный формат статьи для импорта из любого источника (RSS, Telegram и др.). */
export interface RawArticle {
  guid: string;
  title: string;
  url: string;
  content?: string | null;
  publishedAt?: Date | null;
}

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
  private readonly logger = new Logger(ArticlesRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Сохраняет статьи из любого источника, пропуская уже существующие (по sourceId + guid). */
  async upsertMany(sourceId: string, articles: RawArticle[]): Promise<void> {
    const valid = articles.filter((a) => a.title && a.guid);
    const skipped = articles.length - valid.length;

    // Логируем пропущенные статьи для диагностики источников
    if (skipped > 0) {
      this.logger.warn({ sourceId, skipped }, 'Пропущены статьи без title или guid');
    }

    if (valid.length === 0) return;

    const data = valid.map((a) => ({
      sourceId,
      guid: a.guid,
      title: sanitizeText(a.title) ?? '',
      url: a.url,
      content: sanitizeText(a.content),
      publishedAt: a.publishedAt ?? null,
    }));

    await this.prisma.article.createMany({ data, skipDuplicates: true });
  }

  /** Статьи источника, ещё не оценённые для данного пользователя (нет записи UserArticle). */
  findUnscoredBySource(userId: string, sourceId: string): Promise<Article[]> {
    return this.prisma.article.findMany({
      where: {
        sourceId,
        userArticles: { none: { userId } },
      },
      orderBy: { publishedAt: 'desc' },
      take: FEED_DEFAULT_LIMIT,
    });
  }

  /** Возвращает последние N статей источника (по умолчанию FEED_DEFAULT_LIMIT). */
  findBySource(sourceId: string, limit = FEED_DEFAULT_LIMIT): Promise<Article[]> {
    return this.prisma.article.findMany({
      where: { sourceId },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Возвращает страницу фида для пользователя.
   * Включает статьи из активных источников с оценкой >= threshold.
   * Порядок: publishedAt DESC NULLS LAST, id DESC. Cursor-based пагинация.
   *
   * TODO (проблема 6): применяется только глобальный threshold.
   * Per-source threshold требует JOIN с user_preferences по sourceId,
   * что в Prisma реализуется только через $queryRaw.
   */
  async getFeed(
    userId: string,
    threshold: number,
    cursorRaw?: string,
    limit = 20,
  ): Promise<FeedPage> {
    const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;

    /**
     * WHERE-условие для cursor-based пагинации по (publishedAt DESC, id DESC).
     *
     * Алгоритм:
     * 1. Статьи с publishedAt < cursor.publishedAt (строго старше)
     * 2. Статьи с той же датой, но id < cursor.id (tie-breaker)
     * 3. Статьи без publishedAt идут после всех датированных
     *
     * Такой подход даёт стабильный порядок при одинаковых датах.
     */
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
        content: true,
        summary: true,
        aiTitle: true,
        publishedAt: true,
        source: { select: { id: true, title: true, type: true } },
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
      content: row.content,
      summary: row.summary,
      aiTitle: row.aiTitle,
      sourceType: row.source.type,
      publishedAt: row.publishedAt,
      score: row.userArticles[0]?.score ?? null,
      source: { id: row.source.id, title: row.source.title },
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

  /**
   * Сохраняет AI-контент статьи один раз (идемпотентно — пропускает если поле уже заполнено):
   * - TELEGRAM → aiTitle (отдельное поле, оригинальный title не трогается)
   * - RSS/ATOM  → summary
   */
  async updateAiContent(
    articleId: string,
    sourceType: SourceType,
    aiContent: string,
  ): Promise<void> {
    if (sourceType === SourceType.TELEGRAM) {
      await this.prisma.article.updateMany({
        where: { id: articleId, aiTitle: null },
        data: { aiTitle: aiContent },
      });
    } else {
      await this.prisma.article.updateMany({
        where: { id: articleId, summary: null },
        data: { summary: aiContent },
      });
    }
  }

  /**
   * Batch-вариант updateAiContent — один транзакционный вызов вместо N.
   * Все обновления выполняются атомарно внутри одной транзакции.
   */
  async updateAiContentBatch(
    updates: Array<{ articleId: string; sourceType: SourceType; aiContent: string }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    const summaryUpdates = updates.filter((u) => u.sourceType !== SourceType.TELEGRAM);
    const titleUpdates = updates.filter((u) => u.sourceType === SourceType.TELEGRAM);

    await this.prisma.$transaction([
      ...summaryUpdates.map((u) =>
        this.prisma.article.updateMany({
          where: { id: u.articleId, summary: null },
          data: { summary: u.aiContent },
        }),
      ),
      ...titleUpdates.map((u) =>
        this.prisma.article.updateMany({
          where: { id: u.articleId, aiTitle: null },
          data: { aiTitle: u.aiContent },
        }),
      ),
    ]);
  }

  /**
   * Статьи пользователя, ожидающие Telegram-уведомления:
   * не отправленные, оценка >= threshold, источник активен, упорядочены хронологически.
   */
  findPendingTelegramNotifications(
    userId: string,
    threshold: number,
    take: number,
  ): Promise<
    Prisma.UserArticleGetPayload<{ include: { article: { include: { source: true } } } }>[]
  > {
    return this.prisma.userArticle.findMany({
      where: {
        userId,
        telegramNotifiedAt: null,
        score: { gte: threshold },
        article: {
          source: { userSources: { some: { userId, isActive: true } } },
        },
      },
      include: { article: { include: { source: true } } },
      orderBy: { article: { publishedAt: 'asc' } },
      take,
    });
  }

  /** Помечает статью как доставленную в Telegram. */
  async markTelegramNotified(userArticleId: string): Promise<void> {
    await this.prisma.userArticle.update({
      where: { id: userArticleId },
      data: { telegramNotifiedAt: new Date() },
    });
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
