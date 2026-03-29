'use client';

import type { UserSourceWithSource } from '@repo/shared';

import { CategoryPicker } from '@/components/preferences/category-picker';
import { InterestsTextInput } from '@/components/preferences/interests-text-input';
import { ThresholdSlider } from '@/components/preferences/threshold-slider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useResetSourcePreferencesSettings,
  useSourcePreferencesSettings,
  useUpdateSourcePreferencesSettings,
} from '@/hooks/use-preferences';

interface SourcePreferencesDialogProps {
  userSource: UserSourceWithSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Диалог настройки per-source параметров фильтрации (интересы, категории, порог). */
export function SourcePreferencesDialog({
  userSource,
  open,
  onOpenChange,
}: SourcePreferencesDialogProps) {
  const sourceId = userSource.source.id;
  const { data: settings, isLoading } = useSourcePreferencesSettings(sourceId);
  const { mutate: updateSettings, isPending: isUpdating } =
    useUpdateSourcePreferencesSettings(sourceId);
  const { mutate: resetSettings, isPending: isResetting } =
    useResetSourcePreferencesSettings(sourceId);

  const isPending = isUpdating || isResetting;

  function handleReset() {
    resetSettings(undefined, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройки фильтрации</DialogTitle>
          <DialogDescription>
            {userSource.source.title} — переопределяет глобальные настройки только для этого
            источника. Пустые поля наследуют глобальные значения.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Описание интересов */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Описание интересов</h3>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <InterestsTextInput
                value={settings?.interestsText ?? ''}
                onChange={(v) => updateSettings({ interestsText: v })}
                placeholder="Специфика этого источника. Пусто — применяются глобальные интересы."
                disabled={isPending}
              />
            )}
          </div>

          {/* Категории */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Категории</h3>
            {isLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-20 rounded-full" />
                ))}
              </div>
            ) : (
              <CategoryPicker
                selectedSlugs={settings?.selectedCategories ?? []}
                onChange={(slugs) => updateSettings({ selectedCategories: slugs })}
                disabled={isPending}
              />
            )}
          </div>

          {/* Порог релевантности */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Порог релевантности</h3>
            {isLoading ? (
              <Skeleton className="h-5 w-full" />
            ) : (
              <ThresholdSlider
                value={settings?.relevanceThreshold ?? 0.75}
                onChange={(v) => updateSettings({ relevanceThreshold: v })}
                disabled={isPending}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isPending || isLoading}
            className="text-muted-foreground hover:text-foreground"
          >
            {isResetting ? 'Сброс...' : 'Сбросить до глобальных'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
