import { ForbiddenException } from '@nestjs/common';
import type { User } from '@prisma/client';

import type { UsersRepository } from './users.repository';
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
  telegramChatId: null,
  telegramUsername: null,
  telegramLinkToken: null,
  telegramLinkTokenExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: jest.Mocked<
    Pick<
      UsersRepository,
      | 'findById'
      | 'findByEmail'
      | 'updateRole'
      | 'setFeedToken'
      | 'findByFeedToken'
      | 'setTelegramLinkToken'
      | 'findByTelegramLinkToken'
      | 'linkTelegram'
      | 'unlinkTelegram'
      | 'clearLinkToken'
    >
  >;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      updateRole: jest.fn(),
      setFeedToken: jest.fn().mockResolvedValue(undefined),
      findByFeedToken: jest.fn(),
      setTelegramLinkToken: jest.fn().mockResolvedValue(undefined),
      findByTelegramLinkToken: jest.fn(),
      linkTelegram: jest.fn().mockResolvedValue(undefined),
      unlinkTelegram: jest.fn().mockResolvedValue(undefined),
      clearLinkToken: jest.fn().mockResolvedValue(undefined),
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
        role: 'ADMIN' as const,
        telegramChatId: null,
        telegramUsername: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.updateRole.mockResolvedValue(publicUser);
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
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateTelegramLinkToken', () => {
    it('сохраняет токен и возвращает URL с ним', async () => {
      // Фиксируем время, чтобы тест не зависел от скорости CI
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const { url, expiresAt } = await service.generateTelegramLinkToken('user-1');

      expect(mockRepo.setTelegramLinkToken).toHaveBeenCalledWith(
        'user-1',
        expect.stringMatching(/^[0-9a-f]{64}$/),
        new Date('2026-01-01T00:15:00.000Z'),
      );
      expect(url).toContain('t.me');
      expect(expiresAt).toEqual(new Date('2026-01-01T00:15:00.000Z'));

      jest.useRealTimers();
    });
  });

  describe('linkTelegramByToken', () => {
    it('возвращает true и вызывает linkTelegram при валидном токене', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      mockRepo.findByTelegramLinkToken.mockResolvedValue({
        ...baseUser,
        telegramLinkToken: 'valid-token',
        telegramLinkTokenExpiresAt: futureDate,
      });

      const result = await service.linkTelegramByToken('valid-token', '12345', 'testuser');

      expect(result).toBe(true);
      expect(mockRepo.linkTelegram).toHaveBeenCalledWith('user-1', '12345', 'testuser');
    });

    it('возвращает false и очищает только токен при просроченном токене (не трогает привязку)', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockRepo.findByTelegramLinkToken.mockResolvedValue({
        ...baseUser,
        telegramChatId: 'existing-chat-id',
        telegramUsername: 'existinguser',
        telegramLinkToken: 'expired-token',
        telegramLinkTokenExpiresAt: pastDate,
      });

      const result = await service.linkTelegramByToken('expired-token', '12345', 'testuser');

      expect(result).toBe(false);
      // Очищает только токен — существующий аккаунт не затрагивается
      expect(mockRepo.clearLinkToken).toHaveBeenCalledWith('user-1');
      expect(mockRepo.unlinkTelegram).not.toHaveBeenCalled();
      expect(mockRepo.linkTelegram).not.toHaveBeenCalled();
    });

    it('возвращает false если токен не найден', async () => {
      mockRepo.findByTelegramLinkToken.mockResolvedValue(null);

      const result = await service.linkTelegramByToken('unknown-token', '12345', null);

      expect(result).toBe(false);
      expect(mockRepo.linkTelegram).not.toHaveBeenCalled();
    });
  });

  describe('unlinkTelegram', () => {
    it('делегирует вызов в репозиторий', async () => {
      await service.unlinkTelegram('user-1');
      expect(mockRepo.unlinkTelegram).toHaveBeenCalledWith('user-1');
    });
  });
});
