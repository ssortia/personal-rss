import { env } from './env';

export type OAuthProvider = 'google' | 'github' | 'yandex';

/** Возвращает список провайдеров, для которых заданы CLIENT_ID и CLIENT_SECRET. */
export function getEnabledOAuthProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push('google');
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) providers.push('github');
  if (env.YANDEX_CLIENT_ID && env.YANDEX_CLIENT_SECRET) providers.push('yandex');
  return providers;
}
