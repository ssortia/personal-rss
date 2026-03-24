import { Injectable } from '@nestjs/common';
import type { Category, UserPreference } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type UserPreferenceWithCategory = UserPreference & { category: Category };

@Injectable()
export class PreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  findUserPreferences(userId: string): Promise<UserPreferenceWithCategory[]> {
    return this.prisma.userPreference.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { category: { name: 'asc' } },
    });
  }

  async getUserThreshold(userId: string): Promise<{ threshold: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { relevanceThreshold: true },
    });
    return { threshold: user.relevanceThreshold };
  }

  async updateUserThreshold(userId: string, threshold: number): Promise<{ threshold: number }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { relevanceThreshold: threshold },
      select: { relevanceThreshold: true },
    });
    return { threshold: user.relevanceThreshold };
  }

  /** Заменяет все предпочтения пользователя в одной транзакции. */
  async replaceUserPreferences(
    userId: string,
    categoryIds: string[],
  ): Promise<UserPreferenceWithCategory[]> {
    await this.prisma.$transaction([
      this.prisma.userPreference.deleteMany({ where: { userId } }),
      this.prisma.userPreference.createMany({
        data: categoryIds.map((categoryId) => ({ userId, categoryId })),
        skipDuplicates: true,
      }),
    ]);

    return this.findUserPreferences(userId);
  }
}
