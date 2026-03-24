import { api } from '../lib/api';

export const syncApi = {
  trigger: (accessToken: string) =>
    api.post<{ message: string }>('/sync/trigger', {}, { accessToken }),
};
