'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { usersApi } from '../api/users.api';
import { ApiError } from '../lib/api';

/** Хук для получения профиля текущего пользователя.
 *  polling=true включает автообновление каждые 3с — используется при ожидании привязки Telegram. */
export function useCurrentUser({ polling = false }: { polling?: boolean } = {}) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => usersApi.me(session!.accessToken!),
    enabled: !!session?.accessToken,
    refetchInterval: polling ? 3000 : false,
  });
}

/** Хук для генерации одноразовой ссылки привязки Telegram. */
export function useGenerateTelegramLink() {
  const { data: session } = useSession();
  return useMutation({
    mutationFn: () => usersApi.generateTelegramLinkToken(session!.accessToken!),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 503) {
        toast.error(
          'Telegram-бот не настроен на сервере. Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_NAME в .env.',
        );
        return;
      }
      toast.error('Не удалось сгенерировать ссылку');
    },
  });
}

/** Хук для отвязки Telegram-аккаунта. */
export function useUnlinkTelegram() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.unlinkTelegram(session!.accessToken!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      toast.success('Telegram отвязан');
    },
    onError: () => toast.error('Не удалось отвязать Telegram'),
  });
}
