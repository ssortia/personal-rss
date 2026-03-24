'use client';

import { useState } from 'react';

import { AddSourceDtoSchema, AddTelegramSourceDtoSchema } from '@repo/types';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAddSourceError, useAddSource, useAddTelegramSource } from '@/hooks/use-sources';
import { ApiError } from '@/lib/api';

interface AddSourceFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddSourceForm({ onSuccess, onCancel }: AddSourceFormProps) {
  const { mutateAsync: addRss, isPending: isRssPending } = useAddSource();
  const { mutateAsync: addTelegram, isPending: isTelegramPending } = useAddTelegramSource();
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmitRss(data: { url: string }) {
    setServerError(null);
    try {
      await addRss(data);
      onSuccess?.();
    } catch (err) {
      setServerError(getAddSourceError(err));
    }
  }

  async function onSubmitTelegram(data: { username: string }) {
    setServerError(null);
    try {
      await addTelegram(data);
      onSuccess?.();
    } catch (err) {
      setServerError(getTelegramError(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Добавить источник</CardTitle>
        <CardDescription>RSS-лента или публичный Telegram-канал</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="rss" onValueChange={() => setServerError(null)}>
          <TabsList className="mb-4">
            <TabsTrigger value="rss">RSS / Atom</TabsTrigger>
            <TabsTrigger value="telegram">Telegram</TabsTrigger>
          </TabsList>

          <TabsContent value="rss">
            <ZodForm schema={AddSourceDtoSchema} onSubmit={onSubmitRss} className="space-y-4">
              <TextField
                name="url"
                label="URL ленты"
                type="url"
                placeholder="https://example.com/feed.xml"
                required
              />
              {serverError && <p className="text-destructive text-sm">{serverError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={isRssPending}>
                  {isRssPending ? 'Добавление...' : 'Добавить'}
                </Button>
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Отмена
                  </Button>
                )}
              </div>
            </ZodForm>
          </TabsContent>

          <TabsContent value="telegram">
            <ZodForm
              schema={AddTelegramSourceDtoSchema}
              onSubmit={onSubmitTelegram}
              className="space-y-4"
            >
              <TextField
                name="username"
                label="Username канала"
                placeholder="@channel или t.me/channel"
                required
              />
              {serverError && <p className="text-destructive text-sm">{serverError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={isTelegramPending}>
                  {isTelegramPending ? 'Добавление...' : 'Добавить'}
                </Button>
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Отмена
                  </Button>
                )}
              </div>
            </ZodForm>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function getTelegramError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Источник уже добавлен';
    if (error.status === 400) return 'Канал не найден или приватный';
  }
  return 'Произошла ошибка. Попробуйте ещё раз.';
}
