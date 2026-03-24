import { z } from 'zod';

export const SourceTypeSchema = z.enum(['RSS', 'ATOM']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  type: SourceTypeSchema,
  lastFetchAt: z.coerce.date().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Source = z.infer<typeof SourceSchema>;

export const UserSourceWithSourceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sourceId: z.string(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  source: SourceSchema,
});
export type UserSourceWithSource = z.infer<typeof UserSourceWithSourceSchema>;

export const AddSourceDtoSchema = z.object({
  url: z.string().url('Введите корректный URL'),
});
export type AddSourceDto = z.infer<typeof AddSourceDtoSchema>;

export const ToggleSourceDtoSchema = z.object({
  isActive: z.boolean(),
});
export type ToggleSourceDto = z.infer<typeof ToggleSourceDtoSchema>;
