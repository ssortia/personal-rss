import type { NestFastifyApplication } from '@nestjs/platform-fastify';
// @ts-ignore -- IDE-only: test/ исключён из tsconfig, поэтому esModuleInterop не применяется в language server
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service';

import { cleanDb, createE2EApp } from './helpers/app';

// rss-parser делает реальный HTTP-запрос — мокируем чтобы тест был детерминированным
jest.mock('rss-parser', () =>
  jest.fn().mockImplementation(() => ({
    parseURL: jest.fn().mockResolvedValue({
      title: 'Test Feed',
      description: 'Test feed description',
      image: undefined,
      items: [],
    }),
  })),
);

describe('Sources (e2e)', () => {
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

    // Регистрируем тестового пользователя и получаем токен
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'sources@test.com', password: 'Password1!' });
    accessToken = res.body.accessToken;
  });

  describe('GET /sources', () => {
    it('401 — без токена', async () => {
      await request(app.getHttpServer()).get('/sources').expect(401);
    });

    it('200 — возвращает пустой список для нового пользователя', async () => {
      const res = await request(app.getHttpServer())
        .get('/sources')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('POST /sources', () => {
    it('201 — добавляет RSS-источник и возвращает обновлённый список', async () => {
      const res = await request(app.getHttpServer())
        .post('/sources')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: 'https://example.com/feed.xml' })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('source');
      expect(res.body[0].source.url).toBe('https://example.com/feed.xml');
    });

    it('409 — при попытке добавить уже существующий источник', async () => {
      await request(app.getHttpServer())
        .post('/sources')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: 'https://example.com/feed.xml' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/sources')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: 'https://example.com/feed.xml' })
        .expect(409);
    });

    it('401 — без токена', async () => {
      await request(app.getHttpServer())
        .post('/sources')
        .send({ url: 'https://example.com/feed.xml' })
        .expect(401);
    });
  });

  describe('DELETE /sources/:id', () => {
    it('204 — удаляет источник из списка пользователя', async () => {
      // Добавляем источник
      const addRes = await request(app.getHttpServer())
        .post('/sources')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: 'https://example.com/feed.xml' });

      const sourceId = addRes.body[0].source.id;

      // Удаляем
      await request(app.getHttpServer())
        .delete(`/sources/${sourceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Список пуст
      const listRes = await request(app.getHttpServer())
        .get('/sources')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(listRes.body).toHaveLength(0);
    });

    it('404 — при удалении несуществующего источника', async () => {
      await request(app.getHttpServer())
        .delete('/sources/nonexistent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /sources/:id/toggle', () => {
    it('204 — отключает источник', async () => {
      const addRes = await request(app.getHttpServer())
        .post('/sources')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: 'https://example.com/feed.xml' });

      const sourceId = addRes.body[0].source.id;

      await request(app.getHttpServer())
        .patch(`/sources/${sourceId}/toggle`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false })
        .expect(204);
    });
  });
});
