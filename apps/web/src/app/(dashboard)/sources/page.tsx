'use client';

import { useState } from 'react';

import { AddSourceForm } from '@/components/sources/add-source-form';
import { SourceCard } from '@/components/sources/source-card';
import { Button } from '@/components/ui/button';
import { useSources } from '@/hooks/use-sources';

export default function SourcesPage() {
  const { data: userSources, isLoading } = useSources();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Источники</h1>
          <p className="text-muted-foreground text-sm">Управление RSS и Atom лентами</p>
        </div>
        {!showForm && <Button onClick={() => setShowForm(true)}>Добавить источник</Button>}
      </div>

      {showForm && (
        <AddSourceForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Загрузка...</p>}

      {!isLoading && userSources?.length === 0 && !showForm && (
        <div className="text-muted-foreground py-12 text-center">
          <p className="text-lg">Источников пока нет</p>
          <p className="mt-1 text-sm">Добавьте первый RSS или Atom фид</p>
        </div>
      )}

      {userSources && userSources.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {userSources.map((us) => (
            <SourceCard key={us.id} userSource={us} />
          ))}
        </div>
      )}
    </div>
  );
}
