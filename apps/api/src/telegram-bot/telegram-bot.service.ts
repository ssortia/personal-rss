import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Bot } from 'grammy';

import { getEnv } from '../config/env';
import { UsersService } from '../users/users.service';

@Injectable()
export class TelegramBotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;

  constructor(private readonly usersService: UsersService) {
    const token = getEnv().TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не задан — Telegram-бот отключён');
      return;
    }

    this.bot = new Bot(token);

    // Обработчик команды /start с токеном привязки
    this.bot.command('start', async (ctx) => {
      const linkToken = ctx.match?.trim();
      if (!linkToken) {
        await ctx.reply('Используйте ссылку из настроек профиля.');
        return;
      }

      const chatId = String(ctx.chat.id);
      const username = ctx.from?.username ?? null;

      const ok = await this.usersService.linkTelegramByToken(linkToken, chatId, username);
      if (!ok) {
        await ctx.reply(
          'Ссылка устарела или уже использована. Сгенерируйте новую в настройках профиля.',
        );
        return;
      }

      await ctx.reply(
        '✓ Telegram успешно привязан к вашему аккаунту! Теперь вы будете получать отобранные статьи здесь.',
      );
    });
  }

  onApplicationBootstrap(): void {
    if (!this.bot) return;
    // Запускаем long polling в фоне; ошибки логируем, не крашим приложение
    void this.bot
      .start({ drop_pending_updates: true })
      .catch((err: unknown) => this.logger.error('Ошибка запуска Telegram-бота', err));
    this.logger.log('Telegram-бот запущен (long polling)');
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.bot) return;
    await this.bot.stop();
    this.logger.log('Telegram-бот остановлен');
  }
}
