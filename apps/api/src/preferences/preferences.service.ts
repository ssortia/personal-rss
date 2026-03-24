import { Injectable } from '@nestjs/common';
import type { Category } from '@prisma/client';

import type { UserPreferenceWithCategory } from './preferences.repository';
import { PreferencesRepository } from './preferences.repository';

@Injectable()
export class PreferencesService {
  constructor(private readonly preferencesRepository: PreferencesRepository) {}

  getCategories(): Promise<Category[]> {
    return this.preferencesRepository.findAllCategories();
  }

  getUserPreferences(userId: string): Promise<UserPreferenceWithCategory[]> {
    return this.preferencesRepository.findUserPreferences(userId);
  }

  updatePreferences(userId: string, categoryIds: string[]): Promise<UserPreferenceWithCategory[]> {
    return this.preferencesRepository.replaceUserPreferences(userId, categoryIds);
  }

  getThreshold(userId: string): Promise<{ threshold: number }> {
    return this.preferencesRepository.getUserThreshold(userId);
  }

  updateThreshold(userId: string, threshold: number): Promise<{ threshold: number }> {
    return this.preferencesRepository.updateUserThreshold(userId, threshold);
  }
}
