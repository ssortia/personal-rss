import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import type { OAuthConfig } from 'next-auth/providers/index';
import { z } from 'zod';

import type { Role } from '@repo/shared';

import { authApi } from './api/auth.api';
import { usersApi } from './api/users.api';
import { env } from './lib/env';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function getJwtExpiry(accessToken: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString(),
    ) as { exp?: number };
    return (payload.exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}

function parseJwtPayload(accessToken: string): { sub?: string; role?: Role } {
  try {
    return JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString()) as {
      sub?: string;
      role?: Role;
    };
  } catch {
    return {};
  }
}

/** Кастомный провайдер Яндекса — отсутствует в built-in списке next-auth v5 beta. */
function YandexProvider(
  clientId: string,
  clientSecret: string,
): OAuthConfig<{
  id: string;
  login: string;
  real_name?: string;
  default_email: string;
  default_avatar_id?: string;
}> {
  return {
    id: 'yandex',
    name: 'Yandex',
    type: 'oauth',
    clientId,
    clientSecret,
    authorization:
      'https://oauth.yandex.ru/authorize?response_type=code&force_confirm=true&scope=login%3Aemail',
    token: 'https://oauth.yandex.ru/token',
    userinfo: 'https://login.yandex.ru/info?format=json',
    profile(profile) {
      return {
        id: String(profile.id),
        name: null,
        email: profile.default_email,
        image: null,
      };
    },
  };
}

const credentialsProvider = Credentials({
  name: 'credentials',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    const parsed = loginSchema.safeParse(credentials);
    if (!parsed.success) return null;

    try {
      const tokens = await authApi.login(parsed.data);
      const user = await usersApi.me(tokens.accessToken);

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch {
      return null;
    }
  },
});

/** Формирует массив провайдеров на основе доступных env-переменных. */
function buildProviders() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: any[] = [credentialsProvider];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }),
    );
  }

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHub({ clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }),
    );
  }

  if (env.YANDEX_CLIENT_ID && env.YANDEX_CLIENT_SECRET) {
    providers.push(YandexProvider(env.YANDEX_CLIENT_ID, env.YANDEX_CLIENT_SECRET));
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user, account }) {
      // Credentials sign-in: user содержит accessToken/refreshToken из authorize()
      if (account?.type === 'credentials' && user) {
        const u = user as { accessToken?: string; refreshToken?: string; role?: Role };
        token['accessToken'] = u.accessToken;
        token['refreshToken'] = u.refreshToken;
        token['role'] = u.role;
        token['accessTokenExpiry'] = getJwtExpiry(u.accessToken ?? '');
        return token;
      }

      // OAuth sign-in: вызываем бэкенд для получения наших токенов
      if (account?.type === 'oauth' && user?.email) {
        try {
          const tokens = await authApi.oauthLogin({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            email: user.email,
          });
          const payload = parseJwtPayload(tokens.accessToken);
          // Заменяем провайдерский sub на наш внутренний ID пользователя
          token.sub = payload.sub;
          token['accessToken'] = tokens.accessToken;
          token['refreshToken'] = tokens.refreshToken;
          token['role'] = payload.role ?? 'USER';
          token['accessTokenExpiry'] = getJwtExpiry(tokens.accessToken);
          return token;
        } catch {
          return { ...token, error: 'RefreshAccessTokenError' as const };
        }
      }

      // Возвращаем токен без изменений, если он ещё действителен (буфер 30 сек)
      const expiry = token['accessTokenExpiry'] as number;
      if (expiry && Date.now() < expiry - 30_000) {
        return token;
      }

      // Access token истёк — пробуем обновить через refresh token
      try {
        const tokens = await authApi.refresh(token['refreshToken'] as string);
        token['accessToken'] = tokens.accessToken;
        token['refreshToken'] = tokens.refreshToken;
        token['accessTokenExpiry'] = getJwtExpiry(tokens.accessToken);
        delete token['error'];
        return token;
      } catch {
        return { ...token, error: 'RefreshAccessTokenError' as const };
      }
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? '';
      session.user.role = (token['role'] as Role) ?? 'USER';
      session.accessToken = token['accessToken'] as string;
      if (token['error']) {
        session.error = token['error'] as 'RefreshAccessTokenError';
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});
