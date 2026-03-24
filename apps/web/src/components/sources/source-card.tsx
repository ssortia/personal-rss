import type { UserSourceWithSource } from '@repo/types';
import { AlertCircle, Clock, Trash2 } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useDeleteSource, useToggleSource } from '@/hooks/use-sources';

interface SourceCardProps {
  userSource: UserSourceWithSource;
}

/** Форматирует дату в читаемый относительный вид. */
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

export function SourceCard({ userSource }: SourceCardProps) {
  const { source } = userSource;
  const { mutate: deleteSource, isPending: isDeleting } = useDeleteSource();
  const { mutate: toggleSource, isPending: isToggling } = useToggleSource();

  const hasError = !!source.lastError;

  return (
    <Card className={userSource.isActive ? undefined : 'opacity-60'}>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        {source.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source.imageUrl}
            alt=""
            className="h-8 w-8 rounded object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded text-xs font-medium">
            {source.title.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="truncate text-base">{source.title}</CardTitle>
            {/* Бейдж типа источника */}
            <span className="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-xs font-medium">
              {source.type === 'TELEGRAM' ? 'TG' : source.type}
            </span>
          </div>
          <CardDescription className="truncate text-xs">{source.url}</CardDescription>
        </div>

        {/* Переключатель активности */}
        <Switch
          checked={userSource.isActive}
          disabled={isToggling}
          onCheckedChange={(isActive) => toggleSource({ sourceId: source.id, isActive })}
          aria-label={userSource.isActive ? 'Отключить источник' : 'Включить источник'}
        />

        {/* Кнопка удаления с диалогом подтверждения */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Удалить источник</span>
            </Button>
          </AlertDialogTrigger>
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
      </CardHeader>

      {source.description && (
        <CardContent className="pb-0">
          <p className="text-muted-foreground line-clamp-2 text-sm">{source.description}</p>
        </CardContent>
      )}

      {/* Футер: ошибка или время последней синхронизации */}
      <CardFooter className="pt-3">
        {hasError ? (
          <div className="text-destructive flex items-center gap-1.5 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate" title={source.lastError ?? undefined}>
              Ошибка синхронизации
            </span>
          </div>
        ) : source.lastFetchAt ? (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>Синхронизировано {formatSyncTime(source.lastFetchAt)}</span>
          </div>
        ) : (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>Синхронизация не выполнялась</span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
