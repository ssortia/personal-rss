import type { Metadata } from 'next';

import { RegisterForm } from '../../../components/auth/register-form';
import { getEnabledOAuthProviders } from '../../../lib/oauth-providers';

export const metadata: Metadata = { title: 'Регистрация | Curio' };

export default function RegisterPage() {
  return <RegisterForm enabledProviders={getEnabledOAuthProviders()} />;
}
