'use client';

import type { UserSourceWithSource } from '@repo/types';
import { AlertCircle, Clock, EllipsisVertical, Power, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteSource, useToggleSource } from '@/hooks/use-sources';

import { SourceFavicon } from './source-favicon';

interface SourceCardProps {
  userSource: UserSourceWithSource;
}

/** Форматирует дату последней синхронизации в читаемый вид. */
function formatSyncTime(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  return `${days} дн. назад`;
}

const TYPE_LABEL: Record<string, string> = {
  RSS: 'RSS',
  ATOM: 'Atom',
  TELEGRAM: 'Telegram',
};

export function SourceCard({ userSource }: SourceCardProps) {
  const { source } = userSource;
  const { mutate: toggleSource, isPending: isToggling } = useToggleSource();
  const { mutate: deleteSource, isPending: isDeleting } = useDeleteSource();

  const hasError = !!source.lastError;
  const isActive = userSource.isActive;

  return (
    <div
      className={[
        'bg-card border-border group relative flex flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-sm',
        !isActive && 'opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Меню действий — появляется при hover */}
      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                aria-label="Действия"
              >
                <EllipsisVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => toggleSource({ sourceId: source.id, isActive: !isActive })}
                disabled={isToggling}
              >
                <Power className="h-4 w-4" />
                {isActive ? 'Отключить' : 'Включить'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить источник?</AlertDialogTitle>
              <AlertDialogDescription>
                «{source.title}» будет удалён из вашего списка, а его статьи исчезнут из фида. Это
                действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteSource(source.id)}
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Иконка + название + URL — весь блок кликабелен */}
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 pr-6"
      >
        <SourceFavicon url={source.url} type={source.type} imageUrl={source.imageUrl} size={32} />
        <div className="min-w-0">
          <p className="group-hover:text-primary truncate text-sm font-medium leading-snug transition-colors">
            {source.title}
          </p>
          <p className="text-muted-foreground truncate text-xs">{source.url}</p>
        </div>
      </a>

      {/* Footer: тип + статус */}
      <div className="border-border flex items-center gap-2 border-t pt-2.5">
        <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs font-medium">
          {TYPE_LABEL[source.type] ?? source.type}
        </span>
        {hasError ? (
          <div className="text-destructive flex items-center gap-1 text-xs">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>Ошибка синхронизации</span>
          </div>
        ) : (
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              {source.lastFetchAt ? formatSyncTime(source.lastFetchAt) : 'Ещё не синхронизировано'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
