import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Source } from '@prisma/client';
import { SourceType } from '@prisma/client';
import pLimit from 'p-limit';

import { ArticlesRepository } from '../articles/articles.repository';
import { getEnv } from '../config/env';
import { mapRssFeedItems } from '../sources/rss-mapper';
import { SourcesRepository } from '../sources/sources.repository';
import { SourcesService } from '../sources/sources.service';
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
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);

  /**
   * Защита от параллельного запуска двух глобальных синхронизаций в рамках одного процесса.
   * ВНИМАНИЕ: не защищает при горизонтальном масштабировании (несколько инстансов).
   * Для multi-instance нужна распределённая блокировка (например, Redis SETNX).
   */
  private isRunning = false;

  constructor(
    private readonly sourcesRepository: SourcesRepository,
    private readonly sourcesService: SourcesService,
    private readonly articlesRepository: ArticlesRepository,
    private readonly telegramGate: TelegramGate,
  ) {}

  onModuleInit(): void {
    const intervalMs = getEnv().FEED_SYNC_INTERVAL_MIN * 60 * 1000;
    setInterval(() => void this.syncAllSources(), intervalMs);
    this.logger.log(`Планировщик запущен: каждые ${getEnv().FEED_SYNC_INTERVAL_MIN} мин.`);
  }

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
            await this.sourcesService.scoreArticlesForUser(userId, source.id, source.type);
          } catch (err) {
            await this.sourcesRepository.updateLastError(source.id, (err as Error).message);
            this.logger.warn(`[${source.url}] ошибка при синхронизации: ${String(err)}`);
          }
        }),
      ),
    );
  }

  /** Запускает обход всех активных источников (не более 5 параллельно). */
  async syncAllSources(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Синхронизация уже идёт, пропускаем запуск');
      return;
    }
    this.isRunning = true;
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
            this.sourcesService
              .scoreArticlesForUser(uid, source.id, source.type)
              .catch((err: unknown) =>
                this.logger.warn(`Оценка uid=${uid} source=${source.id}: ${String(err)}`),
              ),
          ),
        ),
      );
    } catch (err) {
      await this.sourcesRepository.updateLastError(source.id, (err as Error).message);
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
    const parser = new Parser({ timeout: 10000 });
    const feed = await parser.parseURL(source.url);
    await this.articlesRepository.upsertMany(source.id, mapRssFeedItems(feed.items));
  }

  private async fetchTelegram(source: Source): Promise<void> {
    // username извлекаем из URL вида https://t.me/username
    const username = source.url.replace('https://t.me/', '');
    const channel = await this.telegramGate.fetchChannel(username);
    if (!channel) {
      throw new Error(`Канал @${username} недоступен или приватный`);
    }
    await this.articlesRepository.upsertMany(source.id, channel.posts);
  }
}
