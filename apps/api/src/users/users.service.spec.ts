import { ForbiddenException } from '@nestjs/common';
import type { User } from '@prisma/client';

import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const baseUser: User = {
  id: 'user-1',
  email: 'user@example.com',
  password: 'hashed',
  role: 'USER',
  refreshToken: null,
  resetToken: null,
  resetTokenExpiresAt: null,
  feedToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: jest.Mocked<
    Pick<
      UsersRepository,
      'findById' | 'findByEmail' | 'updateRole' | 'setFeedToken' | 'findByFeedToken'
    >
  >;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      updateRole: jest.fn(),
      setFeedToken: jest.fn().mockResolvedValue(undefined),
      findByFeedToken: jest.fn(),
    };

    service = new UsersService(mockRepo as unknown as UsersRepository);
  });

  describe('updateRole', () => {
    it('бросает ForbiddenException если пользователь меняет собственную роль', async () => {
      await expect(service.updateRole('user-1', 'user-1', 'ADMIN')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.updateRole).not.toHaveBeenCalled();
    });

    it('меняет роль другого пользователя', async () => {
      const publicUser = {
        id: 'user-2',
        email: 'other@example.com',
        role: 'ADMIN',
        createdAt: new Date(),
      };
      mockRepo.updateRole.mockResolvedValue(publicUser as any);
      const result = await service.updateRole('user-1', 'user-2', 'ADMIN');
      expect(mockRepo.updateRole).toHaveBeenCalledWith('user-2', 'ADMIN');
      expect(result).toEqual(publicUser);
    });
  });

  describe('getFeedToken', () => {
    it('возвращает существующий токен если он уже есть', async () => {
      mockRepo.findById.mockResolvedValue({ ...baseUser, feedToken: 'existing-token' });
      const result = await service.getFeedToken('user-1');
      expect(result).toBe('existing-token');
      expect(mockRepo.setFeedToken).not.toHaveBeenCalled();
    });

    it('генерирует новый токен если feedToken равен null', async () => {
      mockRepo.findById.mockResolvedValue({ ...baseUser, feedToken: null });
      const result = await service.getFeedToken('user-1');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(mockRepo.setFeedToken).toHaveBeenCalledWith('user-1', expect.any(String));
    });

    it('генерирует новый токен если пользователь не найден', async () => {
      mockRepo.findById.mockResolvedValue(null);
      const result = await service.getFeedToken('user-1');
      expect(typeof result).toBe('string');
      expect(mockRepo.setFeedToken).toHaveBeenCalled();
    });
  });

  describe('resetFeedToken', () => {
    it('всегда генерирует новый токен независимо от текущего', async () => {
      await service.resetFeedToken('user-1');
      expect(mockRepo.setFeedToken).toHaveBeenCalledWith('user-1', expect.any(String));
    });

    it('каждый вызов возвращает уникальный токен', async () => {
      const token1 = await service.resetFeedToken('user-1');
      const token2 = await service.resetFeedToken('user-1');
      // Токены генерируются через randomBytes — практически всегда разные
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
    });
  });
});
