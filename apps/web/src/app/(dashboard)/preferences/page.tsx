'use client';

import { CategoryPicker } from '@/components/preferences/category-picker';
import { ThresholdSlider } from '@/components/preferences/threshold-slider';

export default function PreferencesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Интересы</h1>
        <p className="text-muted-foreground text-sm">
          Настройте фильтрацию новостей под свои интересы
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Категории</h2>
        <p className="text-muted-foreground text-sm">
          Выберите темы — AI будет учитывать их при оценке статей
        </p>
        <CategoryPicker />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Порог релевантности</h2>
        <p className="text-muted-foreground text-sm">
          Статьи с оценкой ниже порога не попадут в ваш фид
        </p>
        <ThresholdSlider />
      </section>
    </div>
  );
}
