import type { AddSourceDto, UserSourceWithSource } from '@repo/types';

import { api } from '../lib/api';

/** Доменные функции для sources-эндпоинтов. Без React, без хуков — чистые async-функции. */
export const sourcesApi = {
  add: (data: AddSourceDto, accessToken: string) =>
    api.post<UserSourceWithSource[]>('/sources', data, { accessToken }),

  list: (accessToken: string) => api.get<UserSourceWithSource[]>('/sources', { accessToken }),

  delete: (sourceId: string, accessToken: string) =>
    api.delete<void>(`/sources/${sourceId}`, { accessToken }),
};
