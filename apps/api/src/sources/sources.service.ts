import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SourceType } from '@prisma/client';
import { normalizeTelegramUsername } from '@repo/shared';
import Parser from 'rss-parser';

import { ArticlesRepository } from '../articles/articles.repository';
import { ArticlesScoringService } from '../scoring/articles-scoring.service';
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
    private readonly articlesScoringService: ArticlesScoringService,
    private readonly telegramGate: TelegramGate,
  ) {}

  /**
   * Добавляет RSS/Atom-источник для пользователя.
   * Если источник уже существует в БД — переиспользует его (shared sources).
   * Возвращает только что созданный UserSource с данными источника.
   */
  async addSource(userId: string, url: string): Promise<UserSourceWithSource> {
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
    ])
      .then(() => this.articlesScoringService.scoreForUser(userId, source.id, SourceType.RSS))
      .catch((err: unknown) =>
        this.logger.error({ err, sourceUrl: source.url }, 'Ошибка первичного импорта RSS'),
      );

    return this.sourcesRepository.findUserSourceWithSource(userId, source.id);
  }

  /**
   * Добавляет публичный Telegram-канал как источник.
   * Принимает username в любом формате: @channel, t.me/channel, https://t.me/channel.
   * Возвращает только что созданный UserSource с данными источника.
   */
  async addTelegramChannel(userId: string, rawUsername: string): Promise<UserSourceWithSource> {
    const username = normalizeTelegramUsername(rawUsername);

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
      .then(() => this.articlesScoringService.scoreForUser(userId, source.id, SourceType.TELEGRAM))
      .catch((err: unknown) =>
        this.logger.error(`Ошибка импорта постов Telegram @${username}: ${String(err)}`),
      );

    return this.sourcesRepository.findUserSourceWithSource(userId, source.id);
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
}
