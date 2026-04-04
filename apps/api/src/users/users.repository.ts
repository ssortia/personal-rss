import { Injectable } from '@nestjs/common';
import type { Role, User } from '@prisma/client';
import { Prisma } from '@prisma/client';

import type { BaseModelDelegate } from '../common/repository/base.repository';
import { BaseRepository } from '../common/repository/base.repository';
import { PrismaService } from '../prisma/prisma.service';

import type { ListUsersQueryDto } from './dto/list-users-query.dto';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  role: true,
  telegramUsername: true,
  telegramChatId: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_SELECT }>;

@Injectable()
export class UsersRepository extends BaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  constructor(private readonly prisma: PrismaService) {
    // Каст необходим: Prisma-делегаты используют сложные условные дженерики
    // (SelectSubset, GetFindResult, Prisma__ModelClient), которые TypeScript
    // не может унифицировать с простым структурным интерфейсом при присваивании.
    super(
      prisma.user as unknown as BaseModelDelegate<
        User,
        Prisma.UserCreateInput,
        Prisma.UserUpdateInput
      >,
    );
  }

  // Расширяем видимость protected create до public для вызова из UsersService.
  override create(data: Prisma.UserCreateInput): Promise<User> {
    return super.create(data);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findOnePublic(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: PUBLIC_SELECT });
  }

  findAllPublic(query?: ListUsersQueryDto): Promise<PublicUser[]> {
    const where: Prisma.UserWhereInput = {};

    if (query?.email) {
      where.email = { contains: query.email, mode: 'insensitive' };
    }
    if (query?.role) {
      where.role = query.role;
    }

    const sortBy = query?.sortBy ?? 'createdAt';
    const sortOrder = query?.sortOrder ?? 'asc';

    return this.prisma.user.findMany({
      select: PUBLIC_SELECT,
      where,
      orderBy: { [sortBy]: sortOrder },
    });
  }

  updateRole(id: string, role: Role): Promise<PublicUser> {
    return this.prisma.user.update({ where: { id }, data: { role }, select: PUBLIC_SELECT });
  }

  async updateRefreshToken(id: string, hashedToken: string | null): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { refreshToken: hashedToken } });
  }

  async setResetToken(id: string, hashedToken: string, expiresAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { resetToken: hashedToken, resetTokenExpiresAt: expiresAt },
    });
  }

  async clearResetToken(id: string, newHashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { password: newHashedPassword, resetToken: null, resetTokenExpiresAt: null },
    });
  }

  async setFeedToken(id: string, token: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { feedToken: token } });
  }

  findByFeedToken(token: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { feedToken: token } });
  }

  async setTelegramLinkToken(id: string, token: string, expiresAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { telegramLinkToken: token, telegramLinkTokenExpiresAt: expiresAt },
    });
  }

  /** Очищает только поля токена привязки, не трогая telegramChatId/telegramUsername. */
  async clearLinkToken(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { telegramLinkToken: null, telegramLinkTokenExpiresAt: null },
    });
  }

  // Возвращает полную запись пользователя (включая служебные поля токена) — только для внутреннего использования
  findByTelegramLinkToken(token: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { telegramLinkToken: token } });
  }

  async linkTelegram(id: string, chatId: string, username: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        telegramChatId: chatId,
        telegramUsername: username,
        telegramLinkToken: null,
        telegramLinkTokenExpiresAt: null,
      },
    });
  }

  async unlinkTelegram(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        telegramChatId: null,
        telegramUsername: null,
        telegramLinkToken: null,
        telegramLinkTokenExpiresAt: null,
      },
    });
  }

  /** Возвращает всех пользователей с привязанным Telegram-чатом. */
  findWithTelegramChatId(): Promise<Array<{ id: string; telegramChatId: string }>> {
    return this.prisma.user.findMany({
      where: { telegramChatId: { not: null } },
      select: { id: true, telegramChatId: true },
    }) as Promise<Array<{ id: string; telegramChatId: string }>>;
  }

  /** Ищет пользователя по привязанному OAuth-аккаунту. */
  findByOAuthAccount(provider: string, providerAccountId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { oauthAccounts: { some: { provider, providerAccountId } } },
    });
  }

  /** Создаёт нового пользователя без пароля и сразу привязывает OAuth-аккаунт. */
  async createWithOAuth(email: string, provider: string, providerAccountId: string): Promise<User> {
    return this.prisma.user.create({
      data: {
        email,
        oauthAccounts: { create: { provider, providerAccountId } },
      },
    });
  }

  /** Привязывает OAuth-аккаунт к уже существующему пользователю. */
  async linkOAuthAccount(
    userId: string,
    provider: string,
    providerAccountId: string,
  ): Promise<void> {
    await this.prisma.oAuthAccount.upsert({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      create: { userId, provider, providerAccountId },
      update: {},
    });
  }
}
