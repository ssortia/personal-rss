'use client';

import { useEffect, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { usePreferencesSettings, useUpdatePreferencesSettings } from '@/hooks/use-preferences';

/** Debounce-хелпер для текстового поля. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function InterestsTextInput() {
  const { data: settings, isLoading } = usePreferencesSettings();
  const { mutate: updateSettings } = useUpdatePreferencesSettings();

  const [localValue, setLocalValue] = useState('');
  const debouncedValue = useDebounce(localValue, 800);

  useEffect(() => {
    setLocalValue(settings?.interestsText ?? '');
  }, [settings?.interestsText]);

  useEffect(() => {
    const trimmed = debouncedValue.trim() || null;
    const current = settings?.interestsText ?? null;
    if (settings !== undefined && trimmed !== current) {
      updateSettings({ interestsText: trimmed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  if (isLoading) {
    return <div className="bg-muted h-24 w-full animate-pulse rounded-md" />;
  }

  return (
    <div className="space-y-1">
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder="Например: интересует Go, distributed systems, AI. Не интересует политика и спорт."
        className="resize-none"
        rows={4}
        maxLength={2000}
      />
      <p className="text-muted-foreground text-right text-xs">{localValue.length} / 2000</p>
    </div>
  );
}
