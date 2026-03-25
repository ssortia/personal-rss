import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
  // Успешные запросы (2xx/3xx) не попадают в лог — только ошибки 4xx/5xx
  customSuccessfulResponseLogLevel: 'silent',
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
};

@Module({
  imports: [
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
