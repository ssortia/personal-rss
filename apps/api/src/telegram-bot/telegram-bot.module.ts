import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { TelegramBotService } from './telegram-bot.service';

@Module({
  imports: [UsersModule],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
