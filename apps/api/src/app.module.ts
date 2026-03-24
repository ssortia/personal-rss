import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PreferencesModule } from './preferences/preferences.module';
import { PrismaModule } from './prisma/prisma.module';
import { SourcesModule } from './sources/sources.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    SourcesModule,
    PreferencesModule,
    HealthModule,
  ],
})
export class AppModule {}
