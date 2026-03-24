import type { RawArticle } from '../articles/articles.repository';

/** Преобразует элементы rss-parser в универсальный формат RawArticle. */
export function mapRssFeedItems(
  items: Array<{
    guid?: string;
    link?: string;
    title?: string;
    contentSnippet?: string;
    pubDate?: string;
    [key: string]: unknown;
  }>,
): RawArticle[] {
  return items.map((item) => ({
    guid: item.guid ?? item.link ?? item.title ?? '',
    title: item.title ?? '',
    url: item.link ?? '',
    content: item.contentSnippet ?? (item['content'] as string | undefined) ?? null,
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
  }));
}
