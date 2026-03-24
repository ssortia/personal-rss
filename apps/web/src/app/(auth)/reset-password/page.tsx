import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ResetPasswordForm } from '../../../components/auth/reset-password-form';

export const metadata: Metadata = { title: 'Сброс пароля | Curio' };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
