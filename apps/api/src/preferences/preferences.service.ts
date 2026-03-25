import { Injectable } from '@nestjs/common';
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
}
