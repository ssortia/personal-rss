'use client';

import { useState } from 'react';

import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ForgotPasswordDto } from '@repo/shared';
import { ForgotPasswordDtoSchema } from '@repo/shared';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';
import Link from 'next/link';

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(data: ForgotPasswordDto) {
    await authApi.forgotPassword(data);
    // Всегда показываем одно и то же сообщение — не раскрываем наличие аккаунта
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Проверьте почту</CardTitle>
          <CardDescription>
            Если аккаунт с таким email существует, мы отправили письмо со ссылкой для сброса пароля.
            Ссылка действительна 1 час.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm underline hover:opacity-80">
            Вернуться к входу
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Восстановление пароля</CardTitle>
        <CardDescription>Введите email, и мы пришлём ссылку для сброса пароля</CardDescription>
      </CardHeader>
      <CardContent>
        <ZodForm schema={ForgotPasswordDtoSchema} onSubmit={onSubmit} className="space-y-4">
          <TextField
            name="email"
            label="Email"
            type="email"
            placeholder="user@example.com"
            required
          />
          <Button type="submit" className="w-full">
            Отправить письмо
          </Button>
        </ZodForm>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/login" className="hover:text-foreground underline">
            Вернуться к входу
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
