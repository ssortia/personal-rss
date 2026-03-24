'use client';

import { useState } from 'react';

import { AddSourceDtoSchema } from '@repo/types';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAddSourceError, useAddSource } from '@/hooks/use-sources';

interface AddSourceFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddSourceForm({ onSuccess, onCancel }: AddSourceFormProps) {
  const { mutateAsync, isPending } = useAddSource();
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: { url: string }) {
    setServerError(null);
    try {
      await mutateAsync(data);
      onSuccess?.();
    } catch (err) {
      setServerError(getAddSourceError(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Добавить источник</CardTitle>
        <CardDescription>Введите URL RSS или Atom ленты</CardDescription>
      </CardHeader>
      <CardContent>
        <ZodForm schema={AddSourceDtoSchema} onSubmit={onSubmit} className="space-y-4">
          <TextField
            name="url"
            label="URL ленты"
            type="url"
            placeholder="https://example.com/feed.xml"
            required
          />
          {serverError && <p className="text-destructive text-sm">{serverError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Добавление...' : 'Добавить'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Отмена
              </Button>
            )}
          </div>
        </ZodForm>
      </CardContent>
    </Card>
  );
}
