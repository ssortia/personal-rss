import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import type { Role } from '@repo/types';

import { authApi } from './api/auth.api';
import { usersApi } from './api/users.api';

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
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
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { accessToken?: string; refreshToken?: string; role?: Role };
        token['accessToken'] = u.accessToken;
        token['refreshToken'] = u.refreshToken;
        token['role'] = u.role;
        token['accessTokenExpiry'] = getJwtExpiry(u.accessToken ?? '');
        return token;
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
      (session as { accessToken?: string }).accessToken = token['accessToken'] as string;
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
