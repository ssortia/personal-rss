import { Injectable } from '@nestjs/common';
import type { Source, UserSource } from '@prisma/client';
import { SourceType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type UserSourceWithSource = UserSource & { source: Source };

@Injectable()
export class SourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUrl(url: string): Promise<Source | null> {
    return this.prisma.source.findUnique({ where: { url } });
  }

  findById(id: string): Promise<Source | null> {
    return this.prisma.source.findUnique({ where: { id } });
  }

  /** Создаёт источник или обновляет метаданные, если он уже существует. */
  upsertSource(data: {
    url: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    type?: SourceType;
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

  /** Возвращает UserSource вместе с данными Source — используется сразу после создания. */
  findUserSourceWithSource(userId: string, sourceId: string): Promise<UserSourceWithSource> {
    return this.prisma.userSource.findUniqueOrThrow({
      where: { userId_sourceId: { userId, sourceId } },
      include: { source: true },
    });
  }

  findUserSources(userId: string): Promise<UserSourceWithSource[]> {
    return this.prisma.userSource.findMany({
      where: { userId },
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Активные источники пользователя (isActive=true) вместе с метаданными Source. */
  findActiveUserSources(userId: string): Promise<UserSourceWithSource[]> {
    return this.prisma.userSource.findMany({
      where: { userId, isActive: true },
      include: { source: true },
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

  /** Источники, на которые подписан хотя бы один активный пользователь. */
  findActiveSources(): Promise<Source[]> {
    return this.prisma.source.findMany({
      where: { userSources: { some: { isActive: true } } },
    });
  }

  /** ID пользователей, у которых источник активен. */
  findActiveUserIdsForSource(sourceId: string): Promise<string[]> {
    return this.prisma.userSource
      .findMany({
        where: { sourceId, isActive: true },
        select: { userId: true },
      })
      .then((rows) => rows.map((r) => r.userId));
  }

  /** Сохраняет сообщение об ошибке последней синхронизации источника. */
  updateLastError(sourceId: string, error: string): Promise<Source> {
    return this.prisma.source.update({
      where: { id: sourceId },
      data: { lastError: error },
    });
  }
}
