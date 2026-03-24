import { Injectable } from '@nestjs/common';
import type { Source, UserSource } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type UserSourceWithSource = UserSource & { source: Source };

@Injectable()
export class SourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUrl(url: string): Promise<Source | null> {
    return this.prisma.source.findUnique({ where: { url } });
  }

  /** Создаёт источник или обновляет метаданные, если он уже существует. */
  upsertSource(data: {
    url: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
  }): Promise<Source> {
    return this.prisma.source.upsert({
      where: { url: data.url },
      create: data,
      update: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
      },
    });
  }

  updateLastFetchAt(id: string): Promise<Source> {
    return this.prisma.source.update({
      where: { id },
      data: { lastFetchAt: new Date() },
    });
  }

  findUserSource(userId: string, sourceId: string): Promise<UserSource | null> {
    return this.prisma.userSource.findUnique({
      where: { userId_sourceId: { userId, sourceId } },
    });
  }

  createUserSource(userId: string, sourceId: string): Promise<UserSource> {
    return this.prisma.userSource.create({ data: { userId, sourceId } });
  }

  findUserSources(userId: string): Promise<UserSourceWithSource[]> {
    return this.prisma.userSource.findMany({
      where: { userId },
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  toggleUserSource(userId: string, sourceId: string, isActive: boolean): Promise<UserSource> {
    return this.prisma.userSource.update({
      where: { userId_sourceId: { userId, sourceId } },
      data: { isActive },
    });
  }

  deleteUserSource(userId: string, sourceId: string): Promise<UserSource> {
    return this.prisma.userSource.delete({
      where: { userId_sourceId: { userId, sourceId } },
    });
  }
}
