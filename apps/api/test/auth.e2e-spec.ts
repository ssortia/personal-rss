import type { NestFastifyApplication } from '@nestjs/platform-fastify';
// @ts-ignore -- IDE-only: test/ исключён из tsconfig, поэтому esModuleInterop не применяется в language server
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service';

import { cleanDb, createE2EApp } from './helpers/app';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ app, prisma, close } = await createE2EApp());
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await cleanDb(prisma);
  });

  describe('POST /auth/register', () => {
    it('201 — регистрирует пользователя и возвращает токены', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user@test.com', password: 'Password1!' })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('409 — при попытке зарегистрироваться с уже занятым email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@test.com', password: 'Password1!' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@test.com', password: 'Password1!' })
        .expect(409);
    });

    it('400 — при невалидных данных (пустой email)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: '', password: 'Password1!' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'login@test.com', password: 'Password1!' });
    });

    it('200 — возвращает токены при верных credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@test.com', password: 'Password1!' })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('401 — при неверном пароле', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@test.com', password: 'WrongPass!' })
        .expect(401);
    });

    it('401 — при несуществующем email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@test.com', password: 'Password1!' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('204 — разлогинивает авторизованного пользователя', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'logout@test.com', password: 'Password1!' });

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
        .expect(204);
    });

    it('401 — без токена', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });
});
