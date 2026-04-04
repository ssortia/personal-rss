import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, SourceType } from '@prisma/client';
import { GrammyError } from 'grammy';
import pLimit from 'p-limit';

import { ArticlesRepository } from '../articles/articles.repository';
import { PreferencesRepository } from '../preferences/preferences.repository';
import { UsersRepository } from '../users/users.repository';

import { TelegramBotService } from './telegram-bot.service';

/** Максимум статей за один цикл на пользователя — защита от лавины при первой привязке. */
const MAX_ARTICLES_PER_CYCLE = 10;

/**
 * Максимальное число пользователей, обрабатываемых параллельно.
 * Ограничивает число одновременных запросов к Telegram API и предотвращает rate-limit (429).
 */
const MAX_CONCURRENT_USERS = 5;

type PendingArticle = Prisma.UserArticleGetPayload<{
  include: { article: { include: { source: true } } };
}>;

/** Экранирует HTML-спецсимволы для безопасной вставки в сообщение Telegram. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);

  /**
   * Защита от параллельного запуска двух циклов рассылки в рамках одного процесса.
   * Аналог isRunning в SyncService — достаточно для single-instance деплоя.
   */
  private isRunning = false;

  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly usersRepository: UsersRepository,
    private readonly articlesRepository: ArticlesRepository,
    private readonly preferencesRepository: PreferencesRepository,
  ) {}

  /** Каждую минуту проверяем и отправляем накопившиеся статьи. */
  @Cron(CronExpression.EVERY_MINUTE)
  async notifyAll(): Promise<void> {
    if (!this.telegramBotService.isReady()) return;
    if (this.isRunning) {
      this.logger.warn('Рассылка уведомлений уже идёт, пропускаем запуск');
      return;
    }
    this.isRunning = true;

    try {
      const users = await this.usersRepository.findWithTelegramChatId();
      if (users.length === 0) return;

      // Ограничиваем параллелизм чтобы не получить 429 от Telegram API
      const limit = pLimit(MAX_CONCURRENT_USERS);
      await Promise.allSettled(
        users.map((u) => limit(() => this.notifyUser(u.id, u.telegramChatId))),
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async notifyUser(userId: string, chatId: string): Promise<void> {
    const { relevanceThreshold } = await this.preferencesRepository.getSettings(userId);

    const pending = await this.articlesRepository.findPendingTelegramNotifications(
      userId,
      relevanceThreshold,
      MAX_ARTICLES_PER_CYCLE,
    );

    for (const userArticle of pending) {
      await this.sendAndMark(chatId, userArticle);
    }
  }

  private async sendAndMark(chatId: string, userArticle: PendingArticle): Promise<void> {
    const { article } = userArticle;
    try {
      if (article.source.type === SourceType.TELEGRAM) {
        await this.sendTelegramPost(chatId, article);
      } else {
        await this.sendRssArticle(chatId, article);
      }

      // Помечаем как отправленное только при успехе — при ошибке попробуем снова
      await this.articlesRepository.markTelegramNotified(userArticle.id);
    } catch (err: unknown) {
      if (err instanceof GrammyError) {
        if (err.error_code === 403) {
          // Пользователь заблокировал бота — нормальная ситуация, не шумим
          this.logger.debug(`Чат ${chatId} заблокировал бота, пропускаем статью ${article.id}`);
        } else {
          // 429 (rate limit) или 5xx — важно видеть в продакшне
          this.logger.warn(
            `Telegram API [${err.error_code}] при отправке статьи ${article.id} в чат ${chatId}: ${err.description}`,
          );
        }
      } else {
        // Сетевые ошибки, таймауты и прочее
        this.logger.warn(
          `Сетевая ошибка при отправке статьи ${article.id} в чат ${chatId}: ${String(err)}`,
        );
      }
    }
  }

  private async sendRssArticle(
    chatId: string,
    article: Prisma.ArticleGetPayload<{ include: { source: true } }>,
  ): Promise<void> {
    const title = escapeHtml(article.aiTitle ?? article.title);
    // Предпочитаем AI-саммари; fallback — первые 300 символов контента
    const description = article.summary
      ? escapeHtml(article.summary)
      : article.content
        ? escapeHtml(article.content.slice(0, 300)) + '…'
        : null;

    const parts = [`<b>${title}</b>`];
    if (description) parts.push(description);
    // Экранируем URL чтобы кавычки в нём не сломали HTML-атрибут href
    parts.push(`<a href="${escapeHtml(article.url)}">Читать →</a>`);

    await this.telegramBotService.sendMessage(chatId, parts.join('\n\n'));
  }

  private async sendTelegramPost(
    chatId: string,
    article: Prisma.ArticleGetPayload<{ include: { source: true } }>,
  ): Promise<void> {
    // URL вида https://t.me/channelname/12345 — извлекаем имя канала и ID сообщения
    const match = article.url.match(/t\.me\/([^/]+)\/(\d+)/);
    if (match) {
      const [, channel, msgIdStr] = match;
      try {
        await this.telegramBotService.forwardMessage(chatId, `@${channel}`, Number(msgIdStr));
        return;
      } catch {
        // Канал приватный, пост удалён или запрещена пересылка — отправляем как обычную ссылку
        this.logger.debug(
          `forwardMessage из @${channel}/${msgIdStr} не удалось, отправляю ссылкой`,
        );
      }
    }
    // Fallback: отправляем как RSS-статью
    await this.sendRssArticle(chatId, article);
  }
}
