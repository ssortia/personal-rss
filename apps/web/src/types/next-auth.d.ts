import type { DefaultSession } from 'next-auth';

import type { Role } from '@repo/types';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: 'RefreshAccessTokenError';
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }
}
