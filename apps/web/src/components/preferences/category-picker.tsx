'use client';

import {
  useCategories,
  usePreferencesSettings,
  useUpdatePreferencesSettings,
} from '@/hooks/use-preferences';

export function CategoryPicker() {
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: settings, isLoading: loadingSettings } = usePreferencesSettings();
  const { mutate: updateSettings, isPending } = useUpdatePreferencesSettings();

  if (loadingCategories || loadingSettings) {
    return <p className="text-muted-foreground text-sm">Загрузка...</p>;
  }

  const selectedSlugs = new Set(settings?.selectedCategories ?? []);

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
