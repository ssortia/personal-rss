'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import type { UpdatePreferencesDto, UpdateThresholdDto } from '@repo/types';

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

/** Хук для получения выбранных категорий текущего пользователя. */
export function useUserPreferences() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => preferencesApi.getUserPreferences(session!.accessToken!),
    enabled: !!session?.accessToken,
  });
}

/** Хук для получения порога релевантности. */
export function useThreshold() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['threshold'],
    queryFn: () => preferencesApi.getThreshold(session!.accessToken!),
    enabled: !!session?.accessToken,
  });
}

/** Хук для обновления порога релевантности. */
export function useUpdateThreshold() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateThresholdDto) =>
      preferencesApi.updateThreshold(data, session!.accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['threshold'] }),
  });
}

/** Хук для замены всего набора выбранных категорий. */
export function useUpdatePreferences() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePreferencesDto) =>
      preferencesApi.updatePreferences(data, session!.accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  });
}
