import { Injectable } from '@nestjs/common';
import type { Article } from '@prisma/client';
import type { Item } from 'rss-parser';

import { PrismaService } from '../prisma/prisma.service';

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
