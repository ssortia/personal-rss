'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { articlesApi } from '../api/articles.api';

const LIMIT = 20;

/** Хук для бесконечной загрузки персонального фида статей. */
export function useFeed() {
  const { data: session } = useSession();

  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) =>
      articlesApi.getFeed(
        { cursor: pageParam as string | undefined, limit: LIMIT },
        session!.accessToken!,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!session?.accessToken,
  });
}
