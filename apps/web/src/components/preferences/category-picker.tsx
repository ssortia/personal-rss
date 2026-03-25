'use client';

import { useMemo } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  useCategories,
  usePreferencesSettings,
  useUpdatePreferencesSettings,
} from '@/hooks/use-preferences';

export function CategoryPicker() {
  const { data: categories, isLoading: loadingCategories, isError } = useCategories();
  const { data: settings, isLoading: loadingSettings } = usePreferencesSettings();
  const { mutate: updateSettings, isPending } = useUpdatePreferencesSettings();

  // useMemo должен быть до ранних возвратов — правила хуков
  const selectedSlugs = useMemo(
    () => new Set(settings?.selectedCategories ?? []),
    [settings?.selectedCategories],
  );

  if (loadingCategories || loadingSettings) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-muted-foreground text-sm">Не удалось загрузить категории</p>;
  }

  function toggle(slug: string) {
    const next = new Set(selectedSlugs);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    updateSettings({ selectedCategories: Array.from(next) });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories?.map((category) => {
        const selected = selectedSlugs.has(category.slug);
        return (
          <button
            key={category.id}
            onClick={() => toggle(category.slug)}
            disabled={isPending}
            className={[
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:bg-accent',
              isPending ? 'opacity-60' : '',
            ].join(' ')}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
