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

/** Хук для получения per-source настроек (с merge поверх глобальных). */
export function useSourcePreferencesSettings(sourceId: string) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['preferences', 'source', sourceId],
    queryFn: () => preferencesApi.getSourceSettings(sourceId, session!.accessToken!),
    enabled: !!session?.accessToken,
  });
}

/** Хук для обновления per-source настроек (partial merge). */
export function useUpdateSourcePreferencesSettings(sourceId: string) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePreferencesDto) =>
      preferencesApi.updateSourceSettings(sourceId, data, session!.accessToken!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['preferences', 'source', sourceId] }),
  });
}

/**
 * Хук для обновления per-source настроек когда sourceId неизвестен заранее.
 * Используется при добавлении источника — sourceId передаётся в данных мутации.
 */
export function useUpdateAnySourcePreferences() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, ...data }: UpdatePreferencesDto & { sourceId: string }) =>
      preferencesApi.updateSourceSettings(sourceId, data, session!.accessToken!),
    onSuccess: (_, { sourceId }) =>
      queryClient.invalidateQueries({ queryKey: ['preferences', 'source', sourceId] }),
  });
}

/** Хук для сброса per-source настроек (источник начинает использовать глобальные). */
export function useResetSourcePreferencesSettings(sourceId: string) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => preferencesApi.resetSourceSettings(sourceId, session!.accessToken!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['preferences', 'source', sourceId] }),
  });
}
