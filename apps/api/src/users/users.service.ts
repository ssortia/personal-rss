import { randomBytes } from 'crypto';

import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Role, User } from '@prisma/client';

import { getEnv } from '../config/env';

import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { PublicUser } from './users.repository';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  me(userId: string): Promise<PublicUser | null> {
    return this.usersRepository.findOnePublic(userId);
  }

  findAll(query?: ListUsersQueryDto): Promise<PublicUser[]> {
    return this.usersRepository.findAllPublic(query);
  }

  create(email: string, hashedPassword: string): Promise<User> {
    return this.usersRepository.create({ email, password: hashedPassword });
  }

  findByOAuthAccount(provider: string, providerAccountId: string): Promise<User | null> {
    return this.usersRepository.findByOAuthAccount(provider, providerAccountId);
  }

  createWithOAuth(email: string, provider: string, providerAccountId: string): Promise<User> {
    return this.usersRepository.createWithOAuth(email, provider, providerAccountId);
  }

  linkOAuthAccount(userId: string, provider: string, providerAccountId: string): Promise<void> {
    return this.usersRepository.linkOAuthAccount(userId, provider, providerAccountId);
  }

  async updateRole(callerId: string, targetId: string, role: Role): Promise<PublicUser> {
    if (callerId === targetId) throw new ForbiddenException('Cannot change your own role');
    return this.usersRepository.updateRole(targetId, role);
  }

  updateRefreshToken(userId: string, hashedToken: string | null): Promise<void> {
    return this.usersRepository.updateRefreshToken(userId, hashedToken);
  }

  setResetToken(userId: string, hashedToken: string, expiresAt: Date): Promise<void> {
    return this.usersRepository.setResetToken(userId, hashedToken, expiresAt);
  }

  clearResetToken(userId: string, newHashedPassword: string): Promise<void> {
    return this.usersRepository.clearResetToken(userId, newHashedPassword);
  }

  /** Возвращает текущий feedToken; генерирует новый, если ещё не создан. */
  async getFeedToken(userId: string): Promise<string> {
    const user = await this.usersRepository.findById(userId);
    if (user?.feedToken) return user.feedToken;
    return this.generateFeedToken(userId);
  }

  /** Сбрасывает feedToken и возвращает новый. */
  resetFeedToken(userId: string): Promise<string> {
    return this.generateFeedToken(userId);
  }

  private async generateFeedToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.usersRepository.setFeedToken(userId, token);
    return token;
  }

  findByFeedToken(token: string): Promise<User | null> {
    return this.usersRepository.findByFeedToken(token);
  }

  /** Генерирует одноразовый токен для привязки Telegram (TTL 15 мин). */
  async generateTelegramLinkToken(userId: string): Promise<{ url: string; expiresAt: Date }> {
    const { TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_NAME } = getEnv();
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_BOT_NAME) {
      throw new ServiceUnavailableException(
        'Telegram-бот не сконфигурирован. Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_NAME в .env.',
      );
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.usersRepository.setTelegramLinkToken(userId, token, expiresAt);
    const url = `https://t.me/${TELEGRAM_BOT_NAME}?start=${token}`;
    return { url, expiresAt };
  }

  /**
   * Подтверждает привязку по токену из Telegram-бота.
   * Возвращает true — успешно; false — токен не найден или истёк.
   */
  async linkTelegramByToken(
    token: string,
    chatId: string,
    username: string | null,
  ): Promise<boolean> {
    const user = await this.usersRepository.findByTelegramLinkToken(token);
    if (!user) return false;
    if (!user.telegramLinkTokenExpiresAt || user.telegramLinkTokenExpiresAt < new Date()) {
      // Очищаем только токен — существующую привязку не трогаем
      await this.usersRepository.clearLinkToken(user.id);
      return false;
    }
    await this.usersRepository.linkTelegram(user.id, chatId, username);
    return true;
  }

  async unlinkTelegram(userId: string): Promise<void> {
    return this.usersRepository.unlinkTelegram(userId);
  }
}
