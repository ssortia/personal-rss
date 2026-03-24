import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Role, User } from '@prisma/client';
import { randomBytes } from 'crypto';

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
}
