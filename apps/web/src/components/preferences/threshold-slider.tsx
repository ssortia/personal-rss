'use client';

import { useCallback, useEffect, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { usePreferencesSettings, useUpdatePreferencesSettings } from '@/hooks/use-preferences';

/** Debounce-хелпер: вызывает fn не чаще чем раз в delay мс. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function ThresholdSlider() {
  const { data: settings, isLoading } = usePreferencesSettings();
  const { mutate: updateSettings } = useUpdatePreferencesSettings();

  const [localValue, setLocalValue] = useState<number>(0.6);
  const debouncedValue = useDebounce(localValue, 500);

  useEffect(() => {
    if (settings?.relevanceThreshold !== undefined) {
      setLocalValue(settings.relevanceThreshold);
    }
  }, [settings?.relevanceThreshold]);

  const save = useCallback(
    (value: number) => {
      if (settings?.relevanceThreshold !== undefined && value !== settings.relevanceThreshold) {
        updateSettings({ relevanceThreshold: value });
      }
    },
    [settings?.relevanceThreshold, updateSettings],
  );

  useEffect(() => {
    save(debouncedValue);
  }, [debouncedValue, save]);

  if (isLoading) {
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
      />
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>0 — всё подряд</span>
        <span>1 — только точные совпадения</span>
      </div>
    </div>
  );
}
