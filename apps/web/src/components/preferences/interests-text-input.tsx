'use client';

import { useEffect, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '@/hooks/use-debounce';
import { usePreferencesSettings, useUpdatePreferencesSettings } from '@/hooks/use-preferences';

interface InterestsTextInputProps {
  value: string;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Controlled-компонент текстового поля интересов с debounce (800ms). */
export function InterestsTextInput({
  value,
  onChange,
  placeholder = 'Например: интересует Go, distributed systems, AI. Не интересует политика и спорт.',
  disabled,
}: InterestsTextInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 800);

  // Синхронизируем localValue при изменении внешнего value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const trimmed = debouncedValue.trim() || null;
    const current = value.trim() || null;
    if (trimmed !== current) {
      onChange(trimmed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  return (
    <div className="space-y-1">
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="resize-none"
        rows={4}
        maxLength={2000}
        disabled={disabled}
      />
      <p className="text-muted-foreground text-right text-xs">{localValue.length} / 2000</p>
    </div>
  );
}

/** Контейнер: текстовое поле для глобальных настроек (самостоятельно загружает и сохраняет). */
export function GlobalInterestsTextInput() {
  const { data: settings, isLoading } = usePreferencesSettings();
  const { mutate: updateSettings } = useUpdatePreferencesSettings();

  if (isLoading) {
    return <div className="bg-muted h-24 w-full animate-pulse rounded-md" />;
  }

  return (
    <InterestsTextInput
      value={settings?.interestsText ?? ''}
      onChange={(v) => updateSettings({ interestsText: v })}
    />
  );
}
