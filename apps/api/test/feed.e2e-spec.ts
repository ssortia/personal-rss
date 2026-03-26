import type { NestFastifyApplication } from '@nestjs/platform-fastify';
// @ts-ignore -- IDE-only: test/ исключён из tsconfig, поэтому esModuleInterop не применяется в language server
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service';

import { cleanDb, createE2EApp } from './helpers/app';

describe('Feed (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let accessToken: string;

  beforeAll(async () => {
    ({ app, prisma, close } = await createE2EApp());
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await cleanDb(prisma);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'feed@test.com', password: 'Password1!' });
    accessToken = res.body.accessToken;
  });

  describe('GET /feed/token', () => {
    it('401 — без токена', async () => {
      await request(app.getHttpServer()).get('/feed/token').expect(401);
    });

    it('200 — возвращает feedToken для авторизованного пользователя', async () => {
      const res = await request(app.getHttpServer())
        .get('/feed/token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token).toHaveLength(64); // randomBytes(32).toString('hex')
    });

    it('повторный запрос возвращает тот же токен', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/feed/token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/feed/token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res1.body.token).toBe(res2.body.token);
    });
  });

  describe('POST /feed/token/reset', () => {
    it('200 — генерирует новый feedToken', async () => {
      const original = await request(app.getHttpServer())
        .get('/feed/token')
        .set('Authorization', `Bearer ${accessToken}`);

      const reset = await request(app.getHttpServer())
        .post('/feed/token/reset')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(reset.body).toHaveProperty('token');
      expect(reset.body.token).not.toBe(original.body.token);
    });
  });

  describe('GET /feed/:token (публичный RSS)', () => {
    it('404 — при невалидном токене', async () => {
      await request(app.getHttpServer()).get('/feed/invalid-token').expect(404);
    });

    it('200 — возвращает RSS XML по валидному токену', async () => {
      const tokenRes = await request(app.getHttpServer())
        .get('/feed/token')
        .set('Authorization', `Bearer ${accessToken}`);

      const feedToken = tokenRes.body.token;

      const res = await request(app.getHttpServer()).get(`/feed/${feedToken}`).expect(200);

      expect(res.headers['content-type']).toContain('application/rss+xml');
      expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(res.text).toContain('<rss version="2.0">');
      expect(res.text).toContain('feed@test.com');
    });
  });
});
