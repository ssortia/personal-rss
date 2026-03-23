import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ResetPasswordForm } from '../../../components/auth/reset-password-form';

export const metadata: Metadata = { title: 'Сброс пароля | Curio' };

export default function ResetPasswordPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
