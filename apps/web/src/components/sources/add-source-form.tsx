'use client';

import { useState } from 'react';

import { isTelegramInput, normalizeTelegramUsername } from '@repo/shared';

import { CategoryPicker } from '@/components/preferences/category-picker';
import { ThresholdSlider } from '@/components/preferences/threshold-slider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateAnySourcePreferences } from '@/hooks/use-preferences';
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

interface SettingRowProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

/** Строка настройки внутри формы — тот же двухколоночный layout что и PreferencesSection, без карточки. */
function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function AddSourceForm({ onSuccess, onCancel }: AddSourceFormProps) {
  const { mutateAsync: addRss, isPending: isRssPending } = useAddSource();
  const { mutateAsync: addTelegram, isPending: isTelegramPending } = useAddTelegramSource();
  const { mutateAsync: updateSourcePrefs, isPending: isPrefsPending } =
    useUpdateAnySourcePreferences();

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Настройки фильтрации для нового источника
  const [prefInterests, setPrefInterests] = useState('');
  const [prefCategories, setPrefCategories] = useState<string[]>([]);
  const [prefThreshold, setPrefThreshold] = useState(0.75);

  const isPending = isRssPending || isTelegramPending || isPrefsPending;
  const detectedType = detectType(value);
  const trimmed = value.trim();
  const inputError = trimmed ? getInputError(trimmed, detectedType) : null;
  const displayError = error ?? inputError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || inputError) return;

    setError(null);
    let newUserSource;
    try {
      newUserSource =
        detectedType === 'telegram'
          ? await addTelegram({ username: trimmed })
          : await addRss({ url: trimmed });
    } catch (err) {
      setError(getSourceError(err));
      return;
    }

    // Сохраняем per-source настройки отдельно: ошибка здесь не блокирует onSuccess
    // (источник уже добавлен, настройки можно скорректировать позже)
    try {
      await updateSourcePrefs({
        sourceId: newUserSource.source.id,
        interestsText: prefInterests.trim() || null,
        selectedCategories: prefCategories,
        relevanceThreshold: prefThreshold,
      });
    } catch {
      // Некритичная ошибка — источник добавлен, но настройки не сохранились
      console.warn('Не удалось сохранить настройки фильтрации для источника');
    }

    onSuccess?.();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <div className="bg-card border-border rounded-xl border p-5">
        {/* Заголовок */}
        <div className="mb-5">
          <h2 className="font-medium">Добавить источник</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Вставьте ссылку на RSS-ленту или укажите Telegram-канал
          </p>
        </div>

        <div className="space-y-6">
          {/* URL / username */}
          <div className="border-border bg-background focus-within:ring-ring relative flex items-center rounded-lg border focus-within:ring-2 focus-within:ring-offset-2">
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

          {displayError && <p className="text-destructive -mt-3 text-sm">{displayError}</p>}

          {/* Разделитель настроек */}
          <div className="relative">
            <div className="border-border absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-start">
              <span className="bg-card text-muted-foreground pr-3 text-xs">
                Настройки фильтрации
              </span>
            </div>
          </div>

          {/* Описание интересов */}
          <SettingRow
            title="Описание интересов"
            description="Опишите интересы специфичные для этого источника. Пусто — применяются глобальные."
          >
            <div className="space-y-1">
              <Textarea
                value={prefInterests}
                onChange={(e) => setPrefInterests(e.target.value)}
                placeholder="Например: только новости про Rust, без анонсов конференций."
                className="resize-none"
                rows={4}
                maxLength={2000}
                disabled={isPending}
              />
              <p className="text-muted-foreground text-right text-xs">
                {prefInterests.length} / 2000
              </p>
            </div>
          </SettingRow>

          {/* Категории */}
          <SettingRow
            title="Категории"
            description="Переопределить категории для этого источника. Пусто — применяются глобальные."
          >
            <CategoryPicker
              selectedSlugs={prefCategories}
              onChange={setPrefCategories}
              disabled={isPending}
            />
          </SettingRow>

          {/* Порог релевантности */}
          <SettingRow
            title="Порог релевантности"
            description="Статьи с оценкой ниже порога не попадут в ваш фид."
          >
            <ThresholdSlider
              value={prefThreshold}
              onChange={setPrefThreshold}
              disabled={isPending}
            />
          </SettingRow>

          {/* Кнопки */}
          <div className="flex items-center justify-end gap-3 pt-1">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
                Отмена
              </Button>
            )}
            <Button type="submit" disabled={isPending || !trimmed || !!inputError}>
              {isPending ? 'Добавление...' : 'Добавить'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
