'use client';

import { useState } from 'react';

import { isTelegramInput, normalizeTelegramUsername } from '@repo/shared';

import { useAddSource, useAddTelegramSource } from '@/hooks/use-sources';
import { SOURCE_TYPE_COLORS } from '@/lib/badge-colors';
import { getSourceError } from '@/lib/form-errors';

interface AddSourceFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type SourceType = 'rss' | 'telegram';

/** Определяет тип источника по введённому значению. */
function detectType(value: string): SourceType {
  return isTelegramInput(value) ? 'telegram' : 'rss';
}

const TYPE_LABELS: Record<SourceType, string> = {
  rss: 'RSS / Atom',
  telegram: 'Telegram',
};

/** Клиентская валидация ввода для мгновенной обратной связи. */
function getInputError(value: string, type: SourceType): string | null {
  if (type === 'rss') {
    try {
      new URL(value);
    } catch {
      return 'Введите корректный URL';
    }
  }
  if (type === 'telegram') {
    const handle = normalizeTelegramUsername(value);
    if (!/^[a-zA-Z0-9_]{5,}$/.test(handle)) return 'Неверный формат канала';
  }
  return null;
}

export function AddSourceForm({ onSuccess, onCancel }: AddSourceFormProps) {
  const { mutateAsync: addRss, isPending: isRssPending } = useAddSource();
  const { mutateAsync: addTelegram, isPending: isTelegramPending } = useAddTelegramSource();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isPending = isRssPending || isTelegramPending;
  const detectedType = detectType(value);
  const trimmed = value.trim();
  // Показываем клиентскую ошибку только если поле непустое
  const inputError = trimmed ? getInputError(trimmed, detectedType) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || inputError) return;

    setError(null);
    try {
      if (detectedType === 'telegram') {
        await addTelegram({ username: trimmed });
      } else {
        await addRss({ url: trimmed });
      }
      onSuccess?.();
    } catch (err) {
      setError(getSourceError(err));
    }
  }

  const displayError = error ?? inputError;

  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="mb-4">
        <h2 className="font-medium">Добавить источник</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Вставьте ссылку на RSS-ленту или укажите Telegram-канал
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div className="flex items-center gap-2">
          {/* Поле ввода с индикатором типа */}
          <div className="border-border bg-background focus-within:ring-ring relative flex flex-1 items-center rounded-lg border focus-within:ring-2 focus-within:ring-offset-2">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder="https://example.com/feed.xml или @channel"
              disabled={isPending}
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50"
              autoFocus
            />
            {trimmed && (
              <span
                className={`mr-2 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${SOURCE_TYPE_COLORS[detectedType]}`}
              >
                {TYPE_LABELS[detectedType]}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || !trimmed || !!inputError}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? 'Добавление...' : 'Добавить'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="text-muted-foreground hover:text-foreground shrink-0 text-sm transition-colors"
            >
              Отмена
            </button>
          )}
        </div>

        {displayError && <p className="text-destructive text-sm">{displayError}</p>}
      </form>
    </div>
  );
}
