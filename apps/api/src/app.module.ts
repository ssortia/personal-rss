import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { FeedModule } from './feed/feed.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PreferencesModule } from './preferences/preferences.module';
import { PrismaModule } from './prisma/prisma.module';
import { SourcesModule } from './sources/sources.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pinoHttp: {
        // Успешные запросы (2xx/3xx) не попадают в лог — только ошибки 4xx/5xx
        customSuccessfulResponseLogLevel: 'silent',
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      } as any,
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    FeedModule,
    SourcesModule,
    PreferencesModule,
    HealthModule,
  ],
})
export class AppModule {}
