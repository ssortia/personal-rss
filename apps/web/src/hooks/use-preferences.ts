'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import type { UpdatePreferencesDto } from '@repo/shared';

import { preferencesApi } from '../api/preferences.api';

/** Хук для получения списка всех доступных категорий. */
export function useCategories() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => preferencesApi.getCategories(session!.accessToken!),
    enabled: !!session?.accessToken,
    staleTime: Infinity, // категории не меняются, кэшируем навсегда
  });
}

/** Хук для получения глобальных настроек пользователя. */
export function usePreferencesSettings() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => preferencesApi.getSettings(session!.accessToken!),
    enabled: !!session?.accessToken,
  });
}

/** Хук для обновления глобальных настроек (partial merge). */
export function useUpdatePreferencesSettings() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePreferencesDto) =>
      preferencesApi.updateSettings(data, session!.accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  });
}
