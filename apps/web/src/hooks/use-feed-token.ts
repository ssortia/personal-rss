'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { feedTokenApi } from '../api/feed-token.api';

export function useFeedToken() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['feed-token'],
    queryFn: () => feedTokenApi.getToken(session!.accessToken!),
    enabled: !!session?.accessToken,
  });
}

export function useResetFeedToken() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => feedTokenApi.resetToken(session!.accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed-token'] }),
  });
}
