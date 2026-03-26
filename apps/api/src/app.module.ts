import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { FeedModule } from './feed/feed.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PreferencesModule } from './preferences/preferences.module';
import { PrismaModule } from './prisma/prisma.module';
import { SourcesModule } from './sources/sources.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/users.module';

// Конфиг pino-http: без аннотации типа, чтобы обойти расхождение дженериков pino-http v10
const pinoHttpConfig = {
  // 2xx/3xx — silent, 4xx — warn, 5xx и ошибки — error
  customLogLevel: (_req: unknown, res: { statusCode: number }, err: unknown) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'silent';
  },
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
};

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // 20 запросов в минуту по умолчанию; auth-эндпоинты ужесточены до 5 через @Throttle()
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    LoggerModule.forRoot({ pinoHttp: pinoHttpConfig }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    FeedModule,
    SourcesModule,
    SyncModule,
    PreferencesModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
