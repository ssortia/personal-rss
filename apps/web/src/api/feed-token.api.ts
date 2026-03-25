import type { FeedToken } from '@repo/shared';

import { api } from '../lib/api';

export const feedTokenApi = {
  getToken: (accessToken: string) => api.get<FeedToken>('/feed/token', { accessToken }),

  resetToken: (accessToken: string) =>
    api.post<FeedToken>('/feed/token/reset', undefined, { accessToken }),
};
