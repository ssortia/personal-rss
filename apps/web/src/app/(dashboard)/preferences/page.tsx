'use client';

import { CategoryPicker } from '@/components/preferences/category-picker';

export default function PreferencesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Интересы</h1>
        <p className="text-muted-foreground text-sm">Выберите категории, которые вам интересны</p>
      </div>
      <CategoryPicker />
    </div>
  );
}
