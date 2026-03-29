import { Injectable } from '@nestjs/common';
import type { Category } from '@prisma/client';
import type { PreferencesSettings } from '@repo/shared';
import { z } from 'zod';

import { PrismaService } from '../prisma/prisma.service';

const DEFAULTS: Required<PreferencesSettings> = {
  relevanceThreshold: 0.75,
  interestsText: null,
  selectedCategories: [],
};

@Injectable()
export class PreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  /** Проверяет, что пользователь подписан на источник (для проверки доступа в сервисе). */
  async hasUserSource(userId: string, sourceId: string): Promise<boolean> {
    const row = await this.prisma.userSource.findUnique({
      where: { userId_sourceId: { userId, sourceId } },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * Возвращает настройки пользователя.
   * sourceId = undefined → глобальные настройки.
   * sourceId = X → per-source настройки (merge поверх глобальных).
   */
  async getSettings(userId: string, sourceId?: string): Promise<PreferencesSettings> {
    if (sourceId) {
      // Получаем оба ряда отдельными запросами (Prisma не поддерживает OR с null в in-фильтре)
      const [globalRow, sourceRow] = await Promise.all([
        this.prisma.userPreferences.findFirst({ where: { userId, sourceId: null } }),
        this.prisma.userPreferences.findFirst({ where: { userId, sourceId } }),
      ]);
      const global = globalRow;
      const source = sourceRow;
      const globalSettings = this.parseSettings(global?.settings);
      const sourceSettings = this.parseSettings(source?.settings);
      // Поля источника переопределяют глобальные только если явно заданы
      return {
        relevanceThreshold:
          sourceSettings.relevanceThreshold ??
          globalSettings.relevanceThreshold ??
          DEFAULTS.relevanceThreshold,
        interestsText:
          sourceSettings.interestsText !== undefined
            ? sourceSettings.interestsText
            : (globalSettings.interestsText ?? DEFAULTS.interestsText),
        selectedCategories:
          sourceSettings.selectedCategories ??
          globalSettings.selectedCategories ??
          DEFAULTS.selectedCategories,
      };
    }

    // findFirst т.к. Prisma не поддерживает findUnique с null в составном ключе
    const row = await this.prisma.userPreferences.findFirst({
      where: { userId, sourceId: null },
    });
    return this.mergeWithDefaults(this.parseSettings(row?.settings));
  }

  /**
   * Обновляет настройки (partial merge с существующими).
   * sourceId = undefined → глобальные, sourceId = X → per-source.
   */
  async updateSettings(
    userId: string,
    patch: Partial<PreferencesSettings>,
    sourceId?: string,
  ): Promise<PreferencesSettings> {
    const resolvedSourceId = sourceId ?? null;

    // findFirst т.к. Prisma не поддерживает findUnique/upsert с null в составном ключе
    const existing = await this.prisma.userPreferences.findFirst({
      where: { userId, sourceId: resolvedSourceId },
    });

    const current = this.parseSettings(existing?.settings);
    const merged = { ...current, ...patch };

    if (existing) {
      await this.prisma.userPreferences.update({
        where: { id: existing.id },
        data: { settings: merged },
      });
    } else {
      await this.prisma.userPreferences.create({
        data: { userId, sourceId: resolvedSourceId, settings: merged },
      });
    }

    return this.mergeWithDefaults(merged);
  }

  /** Сбрасывает per-source настройки — источник начинает использовать глобальные. */
  async resetSourceSettings(userId: string, sourceId: string): Promise<void> {
    await this.prisma.userPreferences.deleteMany({ where: { userId, sourceId } });
  }

  /** Схема для частичного парсинга настроек из JSON без дефолтов (чтобы undefined ≠ отсутствие). */
  private static readonly rawSettingsSchema = z.object({
    relevanceThreshold: z.number().min(0).max(1).optional(),
    interestsText: z.string().max(2000).nullable().optional(),
    selectedCategories: z.array(z.string()).optional(),
  });

  private parseSettings(raw: unknown): Partial<PreferencesSettings> {
    if (!raw || typeof raw !== 'object') return {};
    const result = PreferencesRepository.rawSettingsSchema.safeParse(raw);
    return result.success ? result.data : {};
  }

  private mergeWithDefaults(settings: Partial<PreferencesSettings>): PreferencesSettings {
    return {
      relevanceThreshold: settings.relevanceThreshold ?? DEFAULTS.relevanceThreshold,
      interestsText:
        settings.interestsText !== undefined ? settings.interestsText : DEFAULTS.interestsText,
      selectedCategories: settings.selectedCategories ?? DEFAULTS.selectedCategories,
    };
  }
}
