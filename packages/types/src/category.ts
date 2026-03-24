import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Category = z.infer<typeof CategorySchema>;

export const PreferencesSettingsSchema = z.object({
  relevanceThreshold: z.number().min(0).max(1).default(0.6),
  interestsText: z.string().max(2000).nullable().default(null),
  selectedCategories: z.array(z.string()).default([]),
});
export type PreferencesSettings = z.infer<typeof PreferencesSettingsSchema>;

export const UpdatePreferencesDtoSchema = PreferencesSettingsSchema.partial();
export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesDtoSchema>;

export const UserArticleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  articleId: z.string(),
  score: z.number().min(0).max(1),
  scoreReason: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type UserArticle = z.infer<typeof UserArticleSchema>;
