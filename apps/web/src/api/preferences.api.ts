import type {
  Category,
  Threshold,
  UpdatePreferencesDto,
  UpdateThresholdDto,
  UserPreferenceWithCategory,
} from '@repo/types';

import { api } from '../lib/api';

/** Доменные функции для preferences-эндпоинтов. Без React, без хуков — чистые async-функции. */
export const preferencesApi = {
  getCategories: (accessToken: string) =>
    api.get<Category[]>('/preferences/categories', { accessToken }),

  getUserPreferences: (accessToken: string) =>
    api.get<UserPreferenceWithCategory[]>('/preferences', { accessToken }),

  updatePreferences: (data: UpdatePreferencesDto, accessToken: string) =>
    api.put<UserPreferenceWithCategory[]>('/preferences', data, { accessToken }),

  getThreshold: (accessToken: string) =>
    api.get<Threshold>('/preferences/threshold', { accessToken }),

  updateThreshold: (data: UpdateThresholdDto, accessToken: string) =>
    api.patch<Threshold>('/preferences/threshold', data, { accessToken }),
};
