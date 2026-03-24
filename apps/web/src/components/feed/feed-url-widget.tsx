'use client';

import { useState } from 'react';

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
import { useFeedToken, useResetFeedToken } from '@/hooks/use-feed-token';
import { env } from '@/lib/env';

function buildFeedUrl(token: string): string {
  return `${env.NEXT_PUBLIC_API_URL}/feed/${token}`;
}

export function FeedUrlWidget() {
  const { data, isLoading } = useFeedToken();
  const { mutate: resetToken, isPending } = useResetFeedToken();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return <div className="bg-muted h-9 w-full animate-pulse rounded-md" />;
  }

  const feedUrl = data ? buildFeedUrl(data.token) : '';

  const handleCopy = () => {
    void navigator.clipboard.writeText(feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <code className="bg-muted text-muted-foreground flex-1 truncate rounded px-3 py-2 text-xs">
        {feedUrl}
      </code>
      <button
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground shrink-0 text-sm transition-colors"
      >
        {copied ? 'Скопировано' : 'Копировать'}
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="text-muted-foreground hover:text-destructive shrink-0 text-sm transition-colors">
            Сбросить
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сбросить ссылку на фид?</AlertDialogTitle>
            <AlertDialogDescription>
              Старая ссылка перестанет работать. Все подключённые ридеры нужно будет обновить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetToken()} disabled={isPending}>
              {isPending ? 'Сброс...' : 'Сбросить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
