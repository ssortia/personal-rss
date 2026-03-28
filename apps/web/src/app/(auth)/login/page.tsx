import type { Metadata } from 'next';

import { LoginForm } from '../../../components/auth/login-form';
import { getEnabledOAuthProviders } from '../../../lib/oauth-providers';

export const metadata: Metadata = {
  title: 'Вход | Curio',
};

export default function LoginPage() {
  return <LoginForm enabledProviders={getEnabledOAuthProviders()} />;
}
