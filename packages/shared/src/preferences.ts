import { z } from 'zod';

export const PreferencesSettingsSchema = z.object({
  relevanceThreshold: z.number().min(0).max(1).default(0.6),
  interestsText: z.string().max(2000).nullable().default(null),
  selectedCategories: z.array(z.string()).default([]),
});
export type PreferencesSettings = z.infer<typeof PreferencesSettingsSchema>;

export const UpdatePreferencesDtoSchema = PreferencesSettingsSchema.partial();
export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesDtoSchema>;
