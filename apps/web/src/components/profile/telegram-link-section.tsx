'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useCurrentUser, useGenerateTelegramLink, useUnlinkTelegram } from '@/hooks/use-profile';

type LinkingState = 'idle' | 'pending';

export function TelegramLinkSection() {
  const [linkingState, setLinkingState] = useState<LinkingState>('idle');

  const { data: user } = useCurrentUser({ polling: linkingState === 'pending' });
  const generateLink = useGenerateTelegramLink();
  const unlinkTelegram = useUnlinkTelegram();

  useEffect(() => {
    // Останавливаем polling по chatId — он всегда есть у привязанного аккаунта,
    // telegramUsername может быть null у пользователей без username в Telegram
    if (linkingState === 'pending' && user?.telegramChatId != null) {
      setLinkingState('idle');
    }
  }, [user?.telegramChatId, linkingState]);

  const handleLink = async () => {
    const result = await generateLink.mutateAsync();
    window.open(result.url, '_blank', 'noopener,noreferrer');
    setLinkingState('pending');
  };

  const isLinked = !!user?.telegramChatId;

  if (isLinked) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Привязан
          </span>
          <span className="text-sm font-medium">
            {user.telegramUsername ? `@${user.telegramUsername}` : 'без имени пользователя'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void unlinkTelegram.mutateAsync()}
          disabled={unlinkTelegram.isPending}
        >
          Отвязать
        </Button>
      </div>
    );
  }

  if (linkingState === 'pending') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="animate-pulse rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            Ожидание...
          </span>
          <p className="text-muted-foreground text-sm">
            Откройте бота в Telegram и нажмите{' '}
            <span className="text-foreground font-medium">START</span>. Страница обновится
            автоматически.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setLinkingState('idle')}>
          Отменить
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => void handleLink()} disabled={generateLink.isPending}>
      Привязать Telegram
    </Button>
  );
}
