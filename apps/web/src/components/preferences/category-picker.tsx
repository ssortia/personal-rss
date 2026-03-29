'use client';

import { useMemo } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  useCategories,
  usePreferencesSettings,
  useUpdatePreferencesSettings,
} from '@/hooks/use-preferences';

interface CategoryPickerProps {
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
  disabled?: boolean;
}

/** Controlled-компонент выбора категорий. */
export function CategoryPicker({ selectedSlugs, onChange, disabled }: CategoryPickerProps) {
  const { data: categories, isLoading, isError } = useCategories();

  // useMemo должен быть до ранних возвратов — правила хуков
  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);

  if (isLoading) {
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
    const next = new Set(selectedSet);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    onChange(Array.from(next));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories?.map((category) => {
        const selected = selectedSet.has(category.slug);
        return (
          <button
            key={category.id}
            onClick={() => toggle(category.slug)}
            disabled={disabled}
            className={[
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:bg-accent',
              disabled ? 'opacity-60' : '',
            ].join(' ')}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}

/** Контейнер: выбор категорий для глобальных настроек (самостоятельно загружает и сохраняет). */
export function GlobalCategoryPicker() {
  const { data: settings, isLoading } = usePreferencesSettings();
  const { mutate: updateSettings, isPending } = useUpdatePreferencesSettings();

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <CategoryPicker
      selectedSlugs={settings?.selectedCategories ?? []}
      onChange={(slugs) => updateSettings({ selectedCategories: slugs })}
      disabled={isPending}
    />
  );
}
