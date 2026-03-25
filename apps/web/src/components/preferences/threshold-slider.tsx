'use client';

import { useEffect, useRef, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { usePreferencesSettings, useUpdatePreferencesSettings } from '@/hooks/use-preferences';

export function ThresholdSlider() {
  const { data: settings, isLoading } = usePreferencesSettings();
  const { mutate: updateSettings } = useUpdatePreferencesSettings();

  const [localValue, setLocalValue] = useState<number | null>(null);
  const initialized = useRef(false);

  // Инициализируем localValue из настроек строго один раз при первой загрузке данных
  useEffect(() => {
    if (!initialized.current && settings?.relevanceThreshold !== undefined) {
      setLocalValue(settings.relevanceThreshold);
      initialized.current = true;
    }
  }, [settings?.relevanceThreshold]);

  if (isLoading || localValue === null) {
    return <div className="bg-muted h-5 w-full animate-pulse rounded" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm">Минимальная релевантность</span>
        <span className="text-primary w-10 text-right text-sm font-semibold">
          {localValue.toFixed(2)}
        </span>
      </div>
      <Slider
        min={0}
        max={1}
        step={0.05}
        value={[localValue]}
        onValueChange={([value]) => setLocalValue(value)}
        onValueCommit={([value]) => updateSettings({ relevanceThreshold: value })}
      />
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>0 — всё подряд</span>
        <span>1 — только точные совпадения</span>
      </div>
    </div>
  );
}
