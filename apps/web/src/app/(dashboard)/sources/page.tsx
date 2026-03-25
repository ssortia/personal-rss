'use client';

import { useState } from 'react';

import { AddSourceForm } from '@/components/sources/add-source-form';
import { SourceCard } from '@/components/sources/source-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useSources, useTriggerSync } from '@/hooks/use-sources';

function SourcesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function SourcesPage() {
  const { data: userSources, isLoading, isError } = useSources();
  const [showForm, setShowForm] = useState(false);
  const { mutate: triggerSync, isPending: isSyncing } = useTriggerSync();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Источники</h1>
          <p className="text-muted-foreground text-sm">Управление RSS и Telegram-каналами</p>
        </div>
        {!showForm && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => triggerSync()} disabled={isSyncing}>
              {isSyncing ? 'Обновляется...' : 'Обновить статьи'}
            </Button>
            <Button onClick={() => setShowForm(true)}>Добавить источник</Button>
          </div>
        )}
      </div>

      {showForm && (
        <AddSourceForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      )}

      {isLoading ? (
        <SourcesSkeleton />
      ) : isError ? (
        <EmptyState
          title="Не удалось загрузить источники"
          description="Проверьте соединение и попробуйте обновить страницу"
        />
      ) : userSources?.length === 0 && !showForm ? (
        <EmptyState
          title="Источников пока нет"
          description="Добавьте первый RSS-фид или Telegram-канал"
        />
      ) : (
        userSources &&
        userSources.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userSources.map((us) => (
              <SourceCard key={us.id} userSource={us} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
