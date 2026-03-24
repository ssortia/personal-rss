'use client';

import { CategoryPicker } from '@/components/preferences/category-picker';
import { InterestsTextInput } from '@/components/preferences/interests-text-input';
import { ThresholdSlider } from '@/components/preferences/threshold-slider';

interface SectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

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
        <Section
          title="Описание интересов"
          description="Опишите свои интересы в свободной форме — AI будет учитывать это при оценке статей."
        >
          <InterestsTextInput />
        </Section>

        <Section
          title="Категории"
          description="Выберите темы, которые вас интересуют — AI будет учитывать их при оценке статей."
        >
          <CategoryPicker />
        </Section>

        <Section
          title="Порог релевантности"
          description="Статьи с оценкой ниже порога не попадут в ваш фид. Чем выше порог — тем строже фильтр."
        >
          <ThresholdSlider />
        </Section>
      </div>
    </div>
  );
}
