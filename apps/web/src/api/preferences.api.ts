import type { Category, PreferencesSettings, UpdatePreferencesDto } from '@repo/shared';

import { api } from '../lib/api';

/** Доменные функции для preferences-эндпоинтов. Без React, без хуков — чистые async-функции. */
export const preferencesApi = {
  getCategories: (accessToken: string) =>
    api.get<Category[]>('/preferences/categories', { accessToken }),

  getSettings: (accessToken: string) =>
    api.get<PreferencesSettings>('/preferences', { accessToken }),

  updateSettings: (data: UpdatePreferencesDto, accessToken: string) =>
    api.patch<PreferencesSettings>('/preferences', data, { accessToken }),
};
