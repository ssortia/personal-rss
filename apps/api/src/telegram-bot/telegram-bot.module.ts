import { Module } from '@nestjs/common';

import { ArticlesModule } from '../articles/articles.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { UsersModule } from '../users/users.module';

import { TelegramBotService } from './telegram-bot.service';
import { TelegramNotificationService } from './telegram-notification.service';

@Module({
  imports: [UsersModule, ArticlesModule, PreferencesModule],
  providers: [TelegramBotService, TelegramNotificationService],
  exports: [TelegramBotService, TelegramNotificationService],
})
export class TelegramBotModule {}
