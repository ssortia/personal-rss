import { ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { PrismaClient, User } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';
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

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-value'),
  compare: jest.fn().mockResolvedValue(true),
}));

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

describe('AuthModule (module)', () => {
  let authService: AuthService;
  let prisma: ReturnType<typeof mockDeep<PrismaClient>>;
  let jwtService: { signAsync: jest.Mock };
  let mailMock: { sendPasswordReset: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    jwtService = { signAsync: jest.fn().mockResolvedValue('mock-token') };
    mailMock = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        UsersRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailMock },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('проходит по DI-цепочке AuthService→UsersService→UsersRepository→Prisma и сохраняет пользователя', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue(baseUser);

      const result = await authService.register('test@example.com', 'password123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'test@example.com' } }),
      );
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'test@example.com' }),
        }),
      );
      expect(result).toHaveProperty('accessToken', 'mock-token');
      expect(result).toHaveProperty('refreshToken', 'mock-token');
    });

    it('бросает ConflictException при дублировании email — prisma.user.create не вызывается', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(authService.register('test@example.com', 'password')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('сохраняет hashed refreshToken в БД через prisma.user.update', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue(baseUser);

      await authService.register('new@example.com', 'password123');

      // Проверяем, что refreshToken в БД хэшируется, а не сохраняется в открытом виде
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ refreshToken: 'hashed-value' }),
        }),
      );
    });
  });

  describe('login', () => {
    it('выдаёт два токена и обновляет refreshToken в БД', async () => {
      prisma.user.update.mockResolvedValue(baseUser);

      const result = await authService.login(baseUser);

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ refreshToken: 'hashed-value' }),
        }),
      );
    });
  });

  describe('refresh', () => {
    it('бросает ForbiddenException если у пользователя нет refreshToken в БД', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, refreshToken: null });

      await expect(authService.refresh('user-1', 'any-token')).rejects.toThrow(ForbiddenException);
    });

    it('обновляет refreshToken в БД при успешном обновлении', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, refreshToken: 'stored-hash' });
      prisma.user.update.mockResolvedValue(baseUser);

      await authService.refresh('user-1', 'valid-refresh-token');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ refreshToken: 'hashed-value' }),
        }),
      );
    });
  });

  describe('logout', () => {
    it('обнуляет refreshToken в БД через DI-цепочку', async () => {
      prisma.user.update.mockResolvedValue(baseUser);

      await authService.logout('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ refreshToken: null }),
        }),
      );
    });
  });

  describe('forgotPassword', () => {
    it('сохраняет resetToken в БД и отправляет письмо через MailService', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue(baseUser);

      await authService.forgotPassword('test@example.com');

      // setResetToken → UsersRepository.setResetToken → prisma.user.update
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            resetToken: 'hashed-value',
            resetTokenExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect(mailMock.sendPasswordReset).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });

    it('не отправляет письмо если пользователь не найден', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await authService.forgotPassword('unknown@example.com');

      expect(mailMock.sendPasswordReset).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('обновляет пароль в БД и очищает resetToken через DI-цепочку', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        resetToken: 'hashed-token',
        resetTokenExpiresAt: new Date(Date.now() + 100_000),
      });
      prisma.user.update.mockResolvedValue(baseUser);

      await authService.resetPassword('test@example.com', 'valid-token', 'NewPass1!');

      // clearResetToken → UsersRepository.clearResetToken → prisma.user.update
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            password: 'hashed-value',
            resetToken: null,
            resetTokenExpiresAt: null,
          }),
        }),
      );
    });
  });
});
