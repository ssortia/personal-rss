import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SourceType } from '@prisma/client';
import Parser from 'rss-parser';

import { ArticlesRepository } from '../articles/articles.repository';
import { getEnv } from '../config/env';
import { PreferencesRepository } from '../preferences/preferences.repository';
import { ScoringService } from '../scoring/scoring.service';
import { TelegramGate } from '../telegram/telegram.gate';

import { mapRssFeedItems } from './rss-mapper';
import type { UserSourceWithSource } from './sources.repository';
import { SourcesRepository } from './sources.repository';

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    private readonly sourcesRepository: SourcesRepository,
    private readonly articlesRepository: ArticlesRepository,
    private readonly preferencesRepository: PreferencesRepository,
    private readonly scoringService: ScoringService,
    private readonly telegramGate: TelegramGate,
  ) {}

  /**
   * Добавляет RSS/Atom-источник для пользователя.
   * Если источник уже существует в БД — переиспользует его (shared sources).
   * Возвращает обновлённый список источников пользователя.
   */
  async addSource(userId: string, url: string): Promise<UserSourceWithSource[]> {
    // Проверяем доступность и валидность ленты
    const parser = new Parser({ timeout: 10000 });
    let feed: Awaited<ReturnType<Parser['parseURL']>>;
    try {
      feed = await parser.parseURL(url);
    } catch {
      throw new BadRequestException('Недоступная или невалидная RSS-лента');
    }

    // Создаём или обновляем метаданные источника
    const source = await this.sourcesRepository.upsertSource({
      url,
      title: feed.title ?? url,
      description: feed.description ?? null,
      imageUrl: feed.image?.url ?? null,
    });

    // Проверяем, не подписан ли пользователь уже
    const existing = await this.sourcesRepository.findUserSource(userId, source.id);
    if (existing) {
      throw new ConflictException('Источник уже добавлен');
    }

    await this.sourcesRepository.createUserSource(userId, source.id);

    const articles = mapRssFeedItems(feed.items);

    // Запускаем первичный импорт статей и AI-оценку асинхронно (fire-and-forget)
    void Promise.all([
      this.articlesRepository.upsertMany(source.id, articles),
      this.sourcesRepository.updateLastFetchAt(source.id),
    ]).then(() => this.scoreArticlesForUser(userId, source.id));

    return this.sourcesRepository.findUserSources(userId);
  }

  /**
   * Добавляет публичный Telegram-канал как источник.
   * Принимает username в любом формате: @channel, t.me/channel, https://t.me/channel.
   */
  async addTelegramChannel(userId: string, rawUsername: string): Promise<UserSourceWithSource[]> {
    const username = this.normalizeTelegramUsername(rawUsername);

    const channel = await this.telegramGate.fetchChannel(username);
    if (!channel) {
      throw new BadRequestException('Канал не найден или приватный');
    }

    const url = `https://t.me/${username}`;
    const source = await this.sourcesRepository.upsertSource({
      url,
      title: channel.title,
      description: channel.description,
      imageUrl: channel.imageUrl,
      type: SourceType.TELEGRAM,
    });

    const existing = await this.sourcesRepository.findUserSource(userId, source.id);
    if (existing) {
      throw new ConflictException('Источник уже добавлен');
    }

    await this.sourcesRepository.createUserSource(userId, source.id);

    this.logger.log(
      `Telegram @${username}: найдено ${channel.posts.length} постов, запуск импорта`,
    );

    void Promise.all([
      this.articlesRepository.upsertMany(source.id, channel.posts),
      this.sourcesRepository.updateLastFetchAt(source.id),
    ])
      .then(() => this.scoreArticlesForUser(userId, source.id))
      .catch((err: unknown) =>
        this.logger.error(`Ошибка импорта постов Telegram @${username}: ${String(err)}`),
      );

    return this.sourcesRepository.findUserSources(userId);
  }

  getUserSources(userId: string): Promise<UserSourceWithSource[]> {
    return this.sourcesRepository.findUserSources(userId);
  }

  /**
   * Переключает активность источника для пользователя.
   * Неактивные источники не обходятся планировщиком и не попадают в фид.
   */
  async toggleSource(userId: string, sourceId: string, isActive: boolean): Promise<void> {
    const existing = await this.sourcesRepository.findUserSource(userId, sourceId);
    if (!existing) {
      throw new NotFoundException('Источник не найден');
    }
    await this.sourcesRepository.toggleUserSource(userId, sourceId, isActive);
  }

  /**
   * Оценивает статьи источника для пользователя батчами через scoreBatch (1 запрос = N статей).
   * Обрабатывает только статьи без существующей оценки (UserArticle).
   * Между батчами выдерживает задержку GROQ_BATCH_DELAY_MS для соблюдения 30 RPM лимита.
   * Запускается асинхронно — ошибки не прерывают основной флоу.
   */
  async scoreArticlesForUser(userId: string, sourceId: string): Promise<void> {
    try {
      const [articles, settings] = await Promise.all([
        this.articlesRepository.findUnscoredBySource(userId, sourceId),
        this.preferencesRepository.getSettings(userId),
      ]);

      const { GROQ_BATCH_SIZE, GROQ_BATCH_DELAY_MS } = getEnv();

      for (let i = 0; i < articles.length; i += GROQ_BATCH_SIZE) {
        const batch = articles.slice(i, i + GROQ_BATCH_SIZE);
        const results = await this.scoringService.scoreBatch(
          batch,
          settings.selectedCategories,
          settings.interestsText,
        );

        await Promise.all(
          batch.map((article, j) =>
            this.articlesRepository.upsertUserArticle(
              userId,
              article.id,
              results[j]!.score,
              results[j]!.reason,
            ),
          ),
        );

        // Задержка между батчами, кроме последнего
        if (i + GROQ_BATCH_SIZE < articles.length) {
          await new Promise((r) => setTimeout(r, GROQ_BATCH_DELAY_MS));
        }
      }
    } catch (err) {
      this.logger.error(`Ошибка AI-оценки статей для userId=${userId}: ${String(err)}`);
    }
  }

  /**
   * Удаляет источник из списка пользователя.
   * Статьи из фида исчезнут автоматически, так как привязаны к источнику.
   */
  async removeSource(userId: string, sourceId: string): Promise<void> {
    const existing = await this.sourcesRepository.findUserSource(userId, sourceId);
    if (!existing) {
      throw new NotFoundException('Источник не найден');
    }
    await this.sourcesRepository.deleteUserSource(userId, sourceId);
  }

  /** Приводит username к чистому виду без @, https://t.me/ и пробелов. */
  private normalizeTelegramUsername(raw: string): string {
    return raw
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^t\.me\//i, '')
      .replace(/^@/, '');
  }
}
