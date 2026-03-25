import { redirect } from 'next/navigation';

import type { Session } from 'next-auth';

import { auth } from '@/auth';

/** Проверяет авторизацию и возвращает сессию. При ошибке редиректит на /login. */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session || session.error === 'RefreshAccessTokenError') {
    redirect('/login');
  }
  return session;
}

/** Дополнительно проверяет роль администратора. При ошибке редиректит на /. */
export async function requireAdminSession(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }
  return session;
}
