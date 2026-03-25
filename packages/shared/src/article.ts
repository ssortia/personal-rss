import { z } from 'zod';

export const FeedTokenSchema = z.object({ token: z.string() });
export type FeedToken = z.infer<typeof FeedTokenSchema>;

export const ArticleFeedItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  content: z.string().nullable(),
  summary: z.string().nullable(),
  aiTitle: z.string().nullable(),
  sourceType: z.enum(['RSS', 'ATOM', 'TELEGRAM']),
  publishedAt: z.coerce.date().nullable(),
  score: z.number().min(0).max(1).nullable(),
  source: z.object({ id: z.string(), title: z.string() }),
});
export type ArticleFeedItem = z.infer<typeof ArticleFeedItemSchema>;

export const FeedPageSchema = z.object({
  items: z.array(ArticleFeedItemSchema),
  nextCursor: z.string().nullable(),
});
export type FeedPage = z.infer<typeof FeedPageSchema>;

export const UserArticleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  articleId: z.string(),
  score: z.number().min(0).max(1),
  scoreReason: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type UserArticle = z.infer<typeof UserArticleSchema>;
