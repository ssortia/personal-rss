import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  NEXTAUTH_URL: z.string().url().optional(),
  // Email (SMTP)
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string().default('Curio <noreply@curio.app>'),
  APP_URL: z.string().url(),
  // Groq API (AI-оценка статей)
  GROQ_API_KEY: z.string().optional(),
  // Количество статей в одном запросе к Groq
  GROQ_BATCH_SIZE: z.coerce.number().int().positive().default(10),
  // Задержка между батчами в мс (минимальная; может быть увеличена по TPM-лимиту)
  GROQ_BATCH_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
  // Лимит токенов в минуту для Groq (бесплатный ключ ~6000 TPM)
  GROQ_TPM_LIMIT: z.coerce.number().int().positive().default(6000),
  // Интервал обхода источников в минутах
  FEED_SYNC_INTERVAL_MIN: z.coerce.number().int().positive().default(30),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
      process.exit(1);
    }
    _env = result.data;
  }
  return _env;
}
