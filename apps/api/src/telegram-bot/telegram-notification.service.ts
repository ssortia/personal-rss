import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, SourceType } from '@prisma/client';
import pLimit from 'p-limit';

import { PrismaService } from '../prisma/prisma.service';

import { TelegramBotService } from './telegram-bot.service';

/** Максимум статей за один цикл на пользователя — защита от лавины при первой привязке. */
const MAX_ARTICLES_PER_CYCLE = 10;

/** Дефолтный порог релевантности если не задан в настройках. */
const DEFAULT_THRESHOLD = 0.6;

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

  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly prisma: PrismaService,
  ) {}

  /** Каждую минуту проверяем и отправляем накопившиеся статьи. */
  @Cron(CronExpression.EVERY_MINUTE)
  async notifyAll(): Promise<void> {
    if (!this.telegramBotService.isReady()) return;

    const users = await this.prisma.user.findMany({
      where: { telegramChatId: { not: null } },
      select: { id: true, telegramChatId: true },
    });

    if (users.length === 0) return;

    // Ограничиваем параллелизм чтобы не получить 429 от Telegram API
    const limit = pLimit(MAX_CONCURRENT_USERS);
    await Promise.allSettled(
      users.map((u) => limit(() => this.notifyUser(u.id, u.telegramChatId!))),
    );
  }

  private async notifyUser(userId: string, chatId: string): Promise<void> {
    const threshold = await this.getUserThreshold(userId);

    const pending = await this.prisma.userArticle.findMany({
      where: {
        userId,
        telegramNotifiedAt: null,
        score: { gte: threshold },
        article: {
          source: { userSources: { some: { userId, isActive: true } } },
        },
      },
      include: { article: { include: { source: true } } },
      // Сначала отправляем самые старые — хронологический порядок
      orderBy: { article: { publishedAt: 'asc' } },
      take: MAX_ARTICLES_PER_CYCLE,
    });

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
      await this.prisma.userArticle.update({
        where: { id: userArticle.id },
        data: { telegramNotifiedAt: new Date() },
      });
    } catch (err: unknown) {
      // Пользователь мог заблокировать бота — не шумим в логах
      this.logger.debug(
        `Не удалось отправить статью ${article.id} в чат ${chatId}: ${String(err)}`,
      );
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
        // Канал приватный или пост удалён — отправляем как обычную ссылку
        this.logger.debug(
          `forwardMessage из @${channel}/${msgIdStr} не удалось, отправляю ссылкой`,
        );
      }
    }
    // Fallback: отправляем как RSS-статью
    await this.sendRssArticle(chatId, article);
  }

  private async getUserThreshold(userId: string): Promise<number> {
    const prefs = await this.prisma.userPreferences.findFirst({
      where: { userId, sourceId: null },
      select: { settings: true },
    });
    const settings = prefs?.settings as { relevanceThreshold?: number } | null;
    return settings?.relevanceThreshold ?? DEFAULT_THRESHOLD;
  }
}
