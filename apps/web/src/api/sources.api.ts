import type { AddSourceDto, ToggleSourceDto, UserSourceWithSource } from '@repo/types';

import { api } from '../lib/api';

/** Доменные функции для sources-эндпоинтов. Без React, без хуков — чистые async-функции. */
export const sourcesApi = {
  add: (data: AddSourceDto, accessToken: string) =>
    api.post<UserSourceWithSource[]>('/sources', data, { accessToken }),

  list: (accessToken: string) => api.get<UserSourceWithSource[]>('/sources', { accessToken }),

  toggle: (sourceId: string, data: ToggleSourceDto, accessToken: string) =>
    api.patch<void>(`/sources/${sourceId}/toggle`, data, { accessToken }),

  delete: (sourceId: string, accessToken: string) =>
    api.delete<void>(`/sources/${sourceId}`, { accessToken }),
};
