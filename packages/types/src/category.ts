import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Category = z.infer<typeof CategorySchema>;

export const UserPreferenceWithCategorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  categoryId: z.string(),
  createdAt: z.coerce.date(),
  category: CategorySchema,
});
export type UserPreferenceWithCategory = z.infer<typeof UserPreferenceWithCategorySchema>;

export const UpdatePreferencesDtoSchema = z.object({
  categoryIds: z.array(z.string()),
});
export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesDtoSchema>;

export const ThresholdSchema = z.object({
  threshold: z.number().min(0).max(1),
});
export type Threshold = z.infer<typeof ThresholdSchema>;

export const UpdateThresholdDtoSchema = z.object({
  threshold: z.number().min(0).max(1),
});
export type UpdateThresholdDto = z.infer<typeof UpdateThresholdDtoSchema>;

export const UserArticleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  articleId: z.string(),
  score: z.number().min(0).max(1),
  scoreReason: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type UserArticle = z.infer<typeof UserArticleSchema>;
