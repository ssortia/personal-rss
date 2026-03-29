import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

import { PrismaService } from '../prisma/prisma.service';

import { PreferencesRepository } from './preferences.repository';
import { PreferencesService } from './preferences.service';

describe('PreferencesModule (module)', () => {
  let preferencesService: PreferencesService;
  let prisma: ReturnType<typeof mockDeep<PrismaClient>>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makePrefRow = (settings: Record<string, unknown>): any => ({
    id: 'pref-1',
    userId: 'user-1',
    sourceId: null,
    settings,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PreferencesService,
        PreferencesRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    preferencesService = moduleRef.get(PreferencesService);
  });

  describe('getSettings', () => {
    it('возвращает дефолтные настройки когда в БД нет записи', async () => {
      prisma.userPreferences.findFirst.mockResolvedValue(null);

      const settings = await preferencesService.getSettings('user-1');

      expect(settings).toEqual({
        relevanceThreshold: 0.75,
        interestsText: null,
        selectedCategories: [],
      });
      expect(prisma.userPreferences.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', sourceId: null } }),
      );
    });

    it('возвращает сохранённые настройки с подстановкой дефолтов для пропущенных полей', async () => {
      // В БД есть только relevanceThreshold — остальные поля должны получить дефолты
      prisma.userPreferences.findFirst.mockResolvedValue(makePrefRow({ relevanceThreshold: 0.8 }));

      const settings = await preferencesService.getSettings('user-1');

      expect(settings.relevanceThreshold).toBe(0.8);
      expect(settings.interestsText).toBeNull(); // дефолт
      expect(settings.selectedCategories).toEqual([]); // дефолт
    });

    it('возвращает полные настройки если все поля сохранены', async () => {
      prisma.userPreferences.findFirst.mockResolvedValue(
        makePrefRow({
          relevanceThreshold: 0.9,
          interestsText: 'AI and ML',
          selectedCategories: ['tech', 'science'],
        }),
      );

      const settings = await preferencesService.getSettings('user-1');

      expect(settings).toEqual({
        relevanceThreshold: 0.9,
        interestsText: 'AI and ML',
        selectedCategories: ['tech', 'science'],
      });
    });
  });

  describe('updateSettings', () => {
    it('создаёт новую запись через prisma.userPreferences.create когда настроек ещё нет', async () => {
      prisma.userPreferences.findFirst.mockResolvedValue(null);
      prisma.userPreferences.create.mockResolvedValue(makePrefRow({ relevanceThreshold: 0.9 }));

      const result = await preferencesService.updateSettings('user-1', {
        relevanceThreshold: 0.9,
      });

      expect(prisma.userPreferences.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            settings: expect.objectContaining({ relevanceThreshold: 0.9 }),
          }),
        }),
      );
      expect(prisma.userPreferences.update).not.toHaveBeenCalled();
      expect(result.relevanceThreshold).toBe(0.9);
    });

    it('обновляет существующую запись и делает merge с текущими настройками', async () => {
      prisma.userPreferences.findFirst.mockResolvedValue(
        makePrefRow({ relevanceThreshold: 0.6, selectedCategories: ['tech'] }),
      );
      prisma.userPreferences.update.mockResolvedValue(
        makePrefRow({ relevanceThreshold: 0.8, selectedCategories: ['tech'] }),
      );

      const result = await preferencesService.updateSettings('user-1', {
        relevanceThreshold: 0.8,
      });

      // update, а не create
      expect(prisma.userPreferences.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pref-1' },
          data: expect.objectContaining({
            settings: expect.objectContaining({
              relevanceThreshold: 0.8,
              selectedCategories: ['tech'], // старые категории сохранились при merge
            }),
          }),
        }),
      );
      expect(prisma.userPreferences.create).not.toHaveBeenCalled();
      expect(result.relevanceThreshold).toBe(0.8);
      expect(result.selectedCategories).toEqual(['tech']);
    });

    it('patch перезаписывает только переданные поля, остальные сохраняются', async () => {
      prisma.userPreferences.findFirst.mockResolvedValue(
        makePrefRow({
          relevanceThreshold: 0.7,
          interestsText: 'existing interests',
          selectedCategories: ['science'],
        }),
      );
      prisma.userPreferences.update.mockResolvedValue(
        makePrefRow({
          relevanceThreshold: 0.7,
          interestsText: 'new interests',
          selectedCategories: ['science'],
        }),
      );

      await preferencesService.updateSettings('user-1', { interestsText: 'new interests' });

      expect(prisma.userPreferences.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            settings: expect.objectContaining({
              relevanceThreshold: 0.7, // не изменилось
              interestsText: 'new interests', // изменилось
              selectedCategories: ['science'], // не изменилось
            }),
          }),
        }),
      );
    });
  });
});
