import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';

import { TelegramBotService } from './telegram-bot.service';
import { TelegramNotificationService } from './telegram-notification.service';

@Module({
  imports: [UsersModule, PrismaModule],
  providers: [TelegramBotService, TelegramNotificationService],
  exports: [TelegramBotService, TelegramNotificationService],
})
export class TelegramBotModule {}
