import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Source } from '@prisma/client';
import { SourceType } from '@prisma/client';
import { normalizeTelegramUsername } from '@repo/shared';
import pLimit from 'p-limit';

import { ArticlesRepository } from '../articles/articles.repository';
import { getEnv } from '../config/env';
import { ArticlesScoringService } from '../scoring/articles-scoring.service';
import { mapRssFeedItems } from '../sources/rss-mapper';
import { SourcesRepository } from '../sources/sources.repository';
import { TelegramGate } from '../telegram/telegram.gate';

/** Повторяет вызов fn до attempts раз с экспоненциальной задержкой (1s, 2s...). */
async function retry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** i * 1000));
    }
  }
  throw new Error('unreachable');
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  /**
   * Защита от параллельного запуска двух глобальных синхронизаций в рамках одного процесса.
   * ВНИМАНИЕ: не защищает при горизонтальном масштабировании (несколько инстансов).
   * Для multi-instance нужна распределённая блокировка (например, Redis SETNX).
   */
  private isRunning = false;

  constructor(
    private readonly sourcesRepository: SourcesRepository,
    private readonly articlesScoringService: ArticlesScoringService,
    private readonly articlesRepository: ArticlesRepository,
    private readonly telegramGate: TelegramGate,
  ) {}

  /**
   * Запускает обход активных источников конкретного пользователя и оценку статей только для него.
   * Используется при ручном запуске из UI.
   */
  async syncForUser(userId: string): Promise<void> {
    const userSources = await this.sourcesRepository.findActiveUserSources(userId);
    this.logger.log(`Ручная синхронизация userId=${userId}: ${userSources.length} источников`);

    const limit = pLimit(5);
    await Promise.all(
      userSources.map(({ source }) =>
        limit(async () => {
          try {
            await this.fetchAndSaveArticles(source);
            await this.articlesScoringService.scoreForUser(userId, source.id, source.type);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await this.sourcesRepository.updateLastError(source.id, message);
            this.logger.warn(`[${source.url}] ошибка при синхронизации: ${String(err)}`);
          }
        }),
      ),
    );
  }

  /**
   * @Cron вместо setInterval: не запускает следующий цикл пока не завершился предыдущий,
   * интегрируется с NestJS lifecycle и логированием.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncAllSources(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Синхронизация уже идёт, пропускаем запуск');
      return;
    }
    this.isRunning = true;

    /**
     * Таймаут-страховка на случай зависшего await внутри синхронизации.
     * При переходе на Redis lock этот таймаут можно убрать.
     */
    const syncTimeoutMs = (getEnv().FEED_SYNC_INTERVAL_MIN - 5) * 60 * 1000;
    const timeout = setTimeout(() => {
      this.logger.error('Синхронизация превысила таймаут, принудительно сбрасываем флаг');
      this.isRunning = false;
    }, syncTimeoutMs);

    try {
      const sources = await this.sourcesRepository.findActiveSources();
      this.logger.log(`Синхронизация: ${sources.length} источников`);

      const limit = pLimit(5);
      await Promise.all(
        sources.map((source) =>
          limit(() =>
            this.syncSource(source).catch((err: unknown) =>
              this.logger.error(`[${source.url}] ошибка синхронизации: ${String(err)}`),
            ),
          ),
        ),
      );
    } finally {
      clearTimeout(timeout);
      this.isRunning = false;
    }
  }

  /**
   * Обновляет статьи одного источника и запускает AI-оценку для всех его подписчиков.
   * Используется глобальным планировщиком.
   */
  private async syncSource(source: Source): Promise<void> {
    try {
      await this.fetchAndSaveArticles(source);

      // Оцениваем новые статьи для каждого активного подписчика (не более 5 параллельно)
      const userIds = await this.sourcesRepository.findActiveUserIdsForSource(source.id);
      const userLimit = pLimit(5);
      await Promise.all(
        userIds.map((uid) =>
          userLimit(() =>
            this.articlesScoringService
              .scoreForUser(uid, source.id, source.type)
              .catch((err: unknown) =>
                this.logger.warn(`Оценка uid=${uid} source=${source.id}: ${String(err)}`),
              ),
          ),
        ),
      );
    } catch (err) {
      // Корректное извлечение сообщения для любого типа ошибки
      const message = err instanceof Error ? err.message : String(err);
      await this.sourcesRepository.updateLastError(source.id, message);
      throw err; // re-throw — внешний .catch() в syncAllSources только логирует
    }
  }

  /** Загружает новые статьи источника и сохраняет их в БД. Без AI-оценки. */
  private async fetchAndSaveArticles(source: Source): Promise<void> {
    if (source.type === SourceType.TELEGRAM) {
      await retry(() => this.fetchTelegram(source), 3);
    } else {
      await retry(() => this.fetchRss(source), 3);
    }
    await this.sourcesRepository.updateLastFetchAt(source.id);
  }

  private async fetchRss(source: Source): Promise<void> {
    const Parser = (await import('rss-parser')).default;
    // Явный User-Agent и Accept — некоторые сайты блокируют ботовые/пустые UA
    const parser = new Parser({
      timeout: 10_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CurioBot/1.0; +https://curio.app)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    });
    const feed = await parser.parseURL(source.url);
    await this.articlesRepository.upsertMany(source.id, mapRssFeedItems(feed.items));
  }

  private async fetchTelegram(source: Source): Promise<void> {
    // username извлекаем из URL вида https://t.me/username
    const username = normalizeTelegramUsername(source.url);
    const channel = await this.telegramGate.fetchChannel(username);
    if (!channel) {
      throw new Error(`Канал @${username} недоступен или приватный`);
    }
    await this.articlesRepository.upsertMany(source.id, channel.posts);
  }
}
