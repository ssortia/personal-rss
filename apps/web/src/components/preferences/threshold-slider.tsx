'use client';

import { useCallback, useEffect, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { useThreshold, useUpdateThreshold } from '@/hooks/use-preferences';

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
  const { data, isLoading } = useThreshold();
  const { mutate: updateThreshold } = useUpdateThreshold();

  const [localValue, setLocalValue] = useState<number>(0.6);
  const debouncedValue = useDebounce(localValue, 500);

  // Инициализируем локальное значение после загрузки
  useEffect(() => {
    if (data?.threshold !== undefined) {
      setLocalValue(data.threshold);
    }
  }, [data?.threshold]);

  // Сохраняем после debounce, только если значение изменилось
  const save = useCallback(
    (value: number) => {
      if (data?.threshold !== undefined && value !== data.threshold) {
        updateThreshold({ threshold: value });
      }
    },
    [data?.threshold, updateThreshold],
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
