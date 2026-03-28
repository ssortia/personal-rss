import type { DefaultSession } from 'next-auth';

import type { Role } from '@repo/shared';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: 'RefreshAccessTokenError' | 'OAuthLoginError';
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }
}
