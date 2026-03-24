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
import { Check, Copy, RotateCcw } from 'lucide-react';

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
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="bg-muted flex min-w-0 flex-1 items-center gap-2 rounded px-3 py-2">
          <code className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{feedUrl}</code>
          <button
            onClick={handleCopy}
            aria-label={copied ? 'Скопировано' : 'Копировать ссылку'}
            className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              aria-label="Сбросить ссылку на фид"
              className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
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
    </div>
  );
}
