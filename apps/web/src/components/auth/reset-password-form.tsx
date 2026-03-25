'use client';

import { useState } from 'react';

import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthError } from '@/lib/form-errors';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';

const schema = z.object({
  password: z.string().min(8, 'Минимум 8 символов'),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: FormValues) {
    setServerError(null);
    try {
      await authApi.resetPassword({ email, token, password: data.password });
      router.push('/login');
    } catch (err) {
      setServerError(getAuthError(err));
    }
  }

  if (!token || !email) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Неверная ссылка</CardTitle>
          <CardDescription>Ссылка для сброса пароля недействительна.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password" className="text-sm underline hover:opacity-80">
            Запросить новую ссылку
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Новый пароль</CardTitle>
        <CardDescription>Введите новый пароль для вашего аккаунта</CardDescription>
      </CardHeader>
      <CardContent>
        <ZodForm schema={schema} onSubmit={onSubmit} className="space-y-4">
          <TextField
            name="password"
            label="Новый пароль"
            type="password"
            placeholder="••••••••"
            required
          />
          {serverError && <p className="text-destructive text-sm">{serverError}</p>}
          <Button type="submit" className="w-full">
            Сохранить пароль
          </Button>
        </ZodForm>
      </CardContent>
    </Card>
  );
}
