import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    API_URL: z.string().url().default('http://localhost:3001'),
    NEXTAUTH_SECRET: z.string().min(32),
    NEXTAUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    YANDEX_CLIENT_ID: z.string().optional(),
    YANDEX_CLIENT_SECRET: z.string().optional(),
    INTERNAL_API_SECRET: z.string().min(32),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  },
  runtimeEnv: {
    API_URL: process.env['API_URL'],
    NEXTAUTH_SECRET: process.env['NEXTAUTH_SECRET'],
    NEXTAUTH_URL: process.env['NEXTAUTH_URL'],
    NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
    GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'],
    GOOGLE_CLIENT_SECRET: process.env['GOOGLE_CLIENT_SECRET'],
    GITHUB_CLIENT_ID: process.env['GITHUB_CLIENT_ID'],
    GITHUB_CLIENT_SECRET: process.env['GITHUB_CLIENT_SECRET'],
    YANDEX_CLIENT_ID: process.env['YANDEX_CLIENT_ID'],
    YANDEX_CLIENT_SECRET: process.env['YANDEX_CLIENT_SECRET'],
    INTERNAL_API_SECRET: process.env['INTERNAL_API_SECRET'],
  },
});
