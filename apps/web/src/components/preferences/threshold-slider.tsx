'use client';

import { useEffect, useRef, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { usePreferencesSettings, useUpdatePreferencesSettings } from '@/hooks/use-preferences';

interface ThresholdSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** Controlled-компонент ползунка порога релевантности. */
export function ThresholdSlider({ value, onChange, disabled }: ThresholdSliderProps) {
  const [localValue, setLocalValue] = useState(value);

  // Синхронизируем localValue при изменении внешнего value (например, при загрузке данных)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

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
        disabled={disabled}
        onValueChange={([v]) => setLocalValue(v)}
        onValueCommit={([v]) => onChange(v)}
      />
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>0 — всё подряд</span>
        <span>1 — только точные совпадения</span>
      </div>
    </div>
  );
}

/** Контейнер: ползунок для глобальных настроек (самостоятельно загружает и сохраняет). */
export function GlobalThresholdSlider() {
  const { data: settings, isLoading } = usePreferencesSettings();
  const { mutate: updateSettings } = useUpdatePreferencesSettings();

  const initialized = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!initialized.current && settings?.relevanceThreshold !== undefined) {
      initialized.current = true;
      setReady(true);
    }
  }, [settings?.relevanceThreshold]);

  if (isLoading || !ready) {
    return <div className="bg-muted h-5 w-full animate-pulse rounded" />;
  }

  return (
    <ThresholdSlider
      value={settings!.relevanceThreshold}
      onChange={(v) => updateSettings({ relevanceThreshold: v })}
    />
  );
}
