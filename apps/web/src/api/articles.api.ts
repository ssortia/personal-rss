import type { FeedPage } from '@repo/types';

import { api } from '../lib/api';

export const articlesApi = {
  getFeed: (params: { cursor?: string; limit?: number }, accessToken: string) =>
    api.get<FeedPage>('/articles', {
      accessToken,
      params: {
        cursor: params.cursor,
        limit: params.limit !== undefined ? String(params.limit) : undefined,
      },
    }),
};
