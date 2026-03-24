import type { UserSourceWithSource } from '@repo/types';
import { Trash2 } from 'lucide-react';

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeleteSource } from '@/hooks/use-sources';

interface SourceCardProps {
  userSource: UserSourceWithSource;
}

export function SourceCard({ userSource }: SourceCardProps) {
  const { source } = userSource;
  const { mutate: deleteSource, isPending } = useDeleteSource();

  return (
    <Card>
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
          <CardTitle className="truncate text-base">{source.title}</CardTitle>
          <CardDescription className="truncate text-xs">{source.url}</CardDescription>
        </div>

        {/* Кнопка удаления с диалогом подтверждения */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
              disabled={isPending}
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
        <CardContent>
          <p className="text-muted-foreground line-clamp-2 text-sm">{source.description}</p>
        </CardContent>
      )}
    </Card>
  );
}
