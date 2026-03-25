import { createHash } from 'crypto';

import type { RawArticle } from '../articles/articles.repository';

type RssItem = {
  guid?: string;
  link?: string;
  title?: string;
  contentSnippet?: string;
  pubDate?: string;
  isoDate?: string;
  [key: string]: unknown;
};

/**
 * Детерминированный GUID для статей без guid/link.
 * Fallback к title ненадёжен — одинаковые заголовки давали дубли.
 * Хэш из title + pubDate даёт уникальный стабильный идентификатор.
 */
function makeGuid(item: RssItem): string {
  if (item.guid) return item.guid;
  if (item.link) return item.link;

  const source = `${item.title ?? ''}::${item.pubDate ?? item.isoDate ?? ''}`;
  return `hash:${createHash('sha1').update(source).digest('hex').slice(0, 16)}`;
}

/** Преобразует элементы rss-parser в универсальный формат RawArticle. */
export function mapRssFeedItems(items: RssItem[]): RawArticle[] {
  return items.map((item) => ({
    guid: makeGuid(item),
    title: item.title ?? '',
    url: item.link ?? '',
    content: item.contentSnippet ?? (item['content'] as string | undefined) ?? null,
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
  }));
}
