import { Injectable, NotFoundException } from '@nestjs/common';
import type { Category } from '@prisma/client';
import type { PreferencesSettings, UpdatePreferencesDto } from '@repo/shared';

import { PreferencesRepository } from './preferences.repository';

@Injectable()
export class PreferencesService {
  constructor(private readonly preferencesRepository: PreferencesRepository) {}

  getCategories(): Promise<Category[]> {
    return this.preferencesRepository.findAllCategories();
  }

  getSettings(userId: string): Promise<PreferencesSettings> {
    return this.preferencesRepository.getSettings(userId);
  }

  updateSettings(userId: string, dto: UpdatePreferencesDto): Promise<PreferencesSettings> {
    return this.preferencesRepository.updateSettings(userId, dto);
  }

  /** Проверяет, что пользователь подписан на источник. Бросает NotFoundException если нет. */
  private async assertUserSource(userId: string, sourceId: string): Promise<void> {
    const exists = await this.preferencesRepository.hasUserSource(userId, sourceId);
    if (!exists) throw new NotFoundException('Source not found');
  }

  async getSourceSettings(userId: string, sourceId: string): Promise<PreferencesSettings> {
    await this.assertUserSource(userId, sourceId);
    return this.preferencesRepository.getSettings(userId, sourceId);
  }

  async updateSourceSettings(
    userId: string,
    sourceId: string,
    dto: UpdatePreferencesDto,
  ): Promise<PreferencesSettings> {
    await this.assertUserSource(userId, sourceId);
    return this.preferencesRepository.updateSettings(userId, dto, sourceId);
  }

  async resetSourceSettings(userId: string, sourceId: string): Promise<void> {
    await this.assertUserSource(userId, sourceId);
    return this.preferencesRepository.resetSourceSettings(userId, sourceId);
  }
}
