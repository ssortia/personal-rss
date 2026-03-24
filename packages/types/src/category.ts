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
