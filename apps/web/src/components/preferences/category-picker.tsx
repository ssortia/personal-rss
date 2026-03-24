'use client';

import { useCategories, useUpdatePreferences, useUserPreferences } from '@/hooks/use-preferences';

export function CategoryPicker() {
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: userPreferences, isLoading: loadingPreferences } = useUserPreferences();
  const { mutate: updatePreferences, isPending } = useUpdatePreferences();

  if (loadingCategories || loadingPreferences) {
    return <p className="text-muted-foreground text-sm">Загрузка...</p>;
  }

  const selectedIds = new Set(userPreferences?.map((p) => p.categoryId) ?? []);

  function toggle(categoryId: string) {
    const next = new Set(selectedIds);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    updatePreferences({ categoryIds: Array.from(next) });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories?.map((category) => {
        const selected = selectedIds.has(category.id);
        return (
          <button
            key={category.id}
            onClick={() => toggle(category.id)}
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
