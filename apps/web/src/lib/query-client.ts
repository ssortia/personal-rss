import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api';

/** Создаёт QueryClient с оптимальными настройками для приложения. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Кэш хранится 5 минут после того как компонент отмонтирован
        gcTime: 5 * 60_000,
        // Не рефетчить при переключении вкладок — данные и так актуальны через staleTime
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Не повторять при ошибках авторизации — нужен редирект, а не ретрай
          if (error instanceof ApiError && error.status === 401) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
