import { z } from 'zod';

export const FeedTokenSchema = z.object({ token: z.string() });
export type FeedToken = z.infer<typeof FeedTokenSchema>;

export const ArticleFeedItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
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
