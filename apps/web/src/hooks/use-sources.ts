'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import type { AddSourceDto } from '@repo/types';

import { sourcesApi } from '../api/sources.api';
import { ApiError } from '../lib/api';

/** Хук для получения списка источников текущего пользователя. */
export function useSources() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => sourcesApi.list(session!.accessToken!),
    enabled: !!session?.accessToken,
  });
}

/** Хук для добавления нового RSS/Atom-источника с автоматической инвалидацией кэша. */
export function useAddSource() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddSourceDto) => sourcesApi.add(data, session!.accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  });
}

/** Хук для удаления источника с автоматической инвалидацией кэша. */
export function useDeleteSource() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => sourcesApi.delete(sourceId, session!.accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  });
}

/** Преобразует ошибку API в читаемое сообщение для формы добавления источника. */
export function getAddSourceError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Источник уже добавлен';
    if (error.status === 400) return 'Недоступная или невалидная RSS-лента';
  }
  return 'Произошла ошибка. Попробуйте ещё раз.';
}
