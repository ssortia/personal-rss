'use client';

import { GlobalCategoryPicker } from '@/components/preferences/category-picker';
import { GlobalInterestsTextInput } from '@/components/preferences/interests-text-input';
import { PreferencesSection } from '@/components/preferences/preferences-section';
import { GlobalThresholdSlider } from '@/components/preferences/threshold-slider';

export default function PreferencesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Интересы</h1>
        <p className="text-muted-foreground text-sm">
          Настройте фильтрацию новостей под свои интересы
        </p>
      </div>

      <div className="space-y-4">
        <PreferencesSection
          title="Описание интересов"
          description="Опишите свои интересы в свободной форме — AI будет учитывать это при оценке статей."
        >
          <GlobalInterestsTextInput />
        </PreferencesSection>

        <PreferencesSection
          title="Категории"
          description="Выберите темы, которые вас интересуют — AI будет учитывать их при оценке статей."
        >
          <GlobalCategoryPicker />
        </PreferencesSection>

        <PreferencesSection
          title="Порог релевантности"
          description="Статьи с оценкой ниже порога не попадут в ваш фид. Чем выше порог — тем строже фильтр."
        >
          <GlobalThresholdSlider />
        </PreferencesSection>
      </div>
    </div>
  );
}
