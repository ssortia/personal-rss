import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

import { AuthService } from './auth.service';

jest.mock('../config/env', () => ({
  getEnv: () => ({
    JWT_SECRET: 'test-secret-must-be-at-least-32-chars!!',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'test-refresh-must-be-at-least-32!!',
    JWT_REFRESH_EXPIRES_IN: '7d',
  }),
}));

// bcryptjs экспортирует hash/compare как non-configurable — мокируем модуль целиком
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('mocked-hash'),
  compare: jest.fn(),
}));

const mockHash = bcrypt.hash as jest.Mock;
const mockCompare = bcrypt.compare as jest.Mock;

// Базовый пользователь для тестов
const baseUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  password: 'hashed-password',
  role: 'USER',
  refreshToken: null,
  resetToken: null,
  resetTokenExpiresAt: null,
  feedToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let mockUsers: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    updateRefreshToken: jest.Mock;
    setResetToken: jest.Mock;
    clearResetToken: jest.Mock;
  };
  let mockJwt: { signAsync: jest.Mock };
  let mockMail: { sendPasswordReset: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockHash.mockResolvedValue('mocked-hash');

    mockUsers = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateRefreshToken: jest.fn().mockResolvedValue(undefined),
      setResetToken: jest.fn().mockResolvedValue(undefined),
      clearResetToken: jest.fn().mockResolvedValue(undefined),
    };

    mockJwt = { signAsync: jest.fn().mockResolvedValue('mock-token') };
    mockMail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(
      mockUsers as unknown as UsersService,
      mockJwt as unknown as JwtService,
      mockMail as unknown as MailService,
    );
  });

  describe('validateUser', () => {
    it('бросает UnauthorizedException если пользователь не найден', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      await expect(service.validateUser('unknown@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('бросает UnauthorizedException при неверном пароле', async () => {
      mockUsers.findByEmail.mockResolvedValue(baseUser);
      mockCompare.mockResolvedValue(false);
      await expect(service.validateUser('test@example.com', 'wrong-pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('возвращает пользователя при верных данных', async () => {
      mockUsers.findByEmail.mockResolvedValue(baseUser);
      mockCompare.mockResolvedValue(true);
      const result = await service.validateUser('test@example.com', 'correct-pass');
      expect(result).toEqual(baseUser);
    });
  });

  describe('generateTokens (через register)', () => {
    it('передаёт корректный expiresIn из env в signAsync (проверяет msDurationToSeconds)', async () => {
      // JWT_EXPIRES_IN='15m' → 900с, JWT_REFRESH_EXPIRES_IN='7d' → 604800с
      mockUsers.findByEmail.mockResolvedValue(null);
      mockUsers.create.mockResolvedValue(baseUser);

      await service.register('new@example.com', 'password123');

      // Access-токен: 15 * 60 = 900
      expect(mockJwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1' }),
        expect.objectContaining({ expiresIn: 900 }),
      );
      // Refresh-токен: 7 * 86400 = 604800
      expect(mockJwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1' }),
        expect.objectContaining({ expiresIn: 604800 }),
      );
    });
  });

  describe('register', () => {
    it('бросает ConflictException если email уже занят', async () => {
      mockUsers.findByEmail.mockResolvedValue(baseUser);
      await expect(service.register('test@example.com', 'password')).rejects.toThrow(
        ConflictException,
      );
    });

    it('создаёт пользователя и возвращает токены при успехе', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      mockUsers.create.mockResolvedValue(baseUser);
      const result = await service.register('new@example.com', 'password123');
      expect(mockUsers.create).toHaveBeenCalledWith('new@example.com', 'mocked-hash');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('refresh', () => {
    it('бросает ForbiddenException если пользователь не найден', async () => {
      mockUsers.findById.mockResolvedValue(null);
      await expect(service.refresh('user-1', 'token')).rejects.toThrow(ForbiddenException);
    });

    it('бросает ForbiddenException если у пользователя нет refreshToken', async () => {
      mockUsers.findById.mockResolvedValue({ ...baseUser, refreshToken: null });
      await expect(service.refresh('user-1', 'token')).rejects.toThrow(ForbiddenException);
    });

    it('бросает ForbiddenException если токен не совпадает', async () => {
      mockUsers.findById.mockResolvedValue({ ...baseUser, refreshToken: 'hashed-token' });
      mockCompare.mockResolvedValue(false);
      await expect(service.refresh('user-1', 'wrong-token')).rejects.toThrow(ForbiddenException);
    });

    it('возвращает новые токены при совпадении', async () => {
      mockUsers.findById.mockResolvedValue({ ...baseUser, refreshToken: 'hashed-token' });
      mockCompare.mockResolvedValue(true);
      const result = await service.refresh('user-1', 'valid-token');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    it('очищает refreshToken пользователя', async () => {
      await service.logout('user-1');
      expect(mockUsers.updateRefreshToken).toHaveBeenCalledWith('user-1', null);
    });
  });

  describe('forgotPassword', () => {
    it('молча возвращает если пользователь не найден', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      await expect(service.forgotPassword('unknown@example.com')).resolves.toBeUndefined();
      expect(mockMail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('сохраняет reset-токен и отправляет письмо если пользователь найден', async () => {
      mockUsers.findByEmail.mockResolvedValue(baseUser);
      await service.forgotPassword('test@example.com');
      expect(mockUsers.setResetToken).toHaveBeenCalledWith(
        'user-1',
        'mocked-hash',
        expect.any(Date),
      );
      expect(mockMail.sendPasswordReset).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });
  });

  describe('resetPassword', () => {
    it('бросает BadRequestException если нет resetToken', async () => {
      mockUsers.findByEmail.mockResolvedValue({ ...baseUser, resetToken: null });
      await expect(service.resetPassword('test@example.com', 'token', 'newpass')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('бросает BadRequestException если нет resetTokenExpiresAt', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        ...baseUser,
        resetToken: 'hashed',
        resetTokenExpiresAt: null,
      });
      await expect(service.resetPassword('test@example.com', 'token', 'newpass')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('бросает BadRequestException если токен просрочен', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        ...baseUser,
        resetToken: 'hashed',
        resetTokenExpiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.resetPassword('test@example.com', 'token', 'newpass')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('бросает BadRequestException если токен не совпадает', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        ...baseUser,
        resetToken: 'hashed',
        resetTokenExpiresAt: new Date(Date.now() + 100_000),
      });
      mockCompare.mockResolvedValue(false);
      await expect(
        service.resetPassword('test@example.com', 'wrong-token', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('очищает токен и обновляет пароль при успешном сбросе', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        ...baseUser,
        resetToken: 'hashed',
        resetTokenExpiresAt: new Date(Date.now() + 100_000),
      });
      mockCompare.mockResolvedValue(true);
      await service.resetPassword('test@example.com', 'valid-token', 'NewPass1!');
      expect(mockUsers.clearResetToken).toHaveBeenCalledWith('user-1', 'mocked-hash');
    });
  });
});
