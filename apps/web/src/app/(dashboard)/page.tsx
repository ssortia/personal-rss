'use client';

import Link from 'next/link';

import { ArticleCard } from '@/components/feed/article-card';
import { FeedUrlWidget } from '@/components/feed/feed-url-widget';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeed } from '@/hooks/use-feed';

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-b py-4">
          <Skeleton className="mb-2 h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default function FeedPage() {
  const { data, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage } = useFeed();

  const articles = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Фид</h1>
          <p className="text-muted-foreground text-sm">Отобранные статьи по вашим интересам</p>
        </div>
        <FeedUrlWidget />
      </div>

      {isLoading ? (
        <FeedSkeleton />
      ) : isError ? (
        <EmptyState
          title="Не удалось загрузить статьи"
          description="Проверьте соединение и попробуйте обновить страницу"
        />
      ) : articles.length === 0 ? (
        <EmptyState
          title="Статей пока нет"
          description={
            <span>
              Добавьте источники в{' '}
              <Link href="/sources" className="text-primary underline-offset-4 hover:underline">
                разделе «Источники»
              </Link>{' '}
              и настройте интересы
            </span>
          }
        />
      ) : (
        <>
          <div>
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center">
              <button
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Загрузка...' : 'Загрузить ещё'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
