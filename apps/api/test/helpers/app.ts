import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';

import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/mail/mail.service';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface E2EApp {
  app: NestFastifyApplication;
  prisma: PrismaService;
  close: () => Promise<void>;
}

/**
 * Поднимает полноценное NestJS-приложение с тестовой БД.
 * MailService замокан — письма не отправляются.
 */
export async function createE2EApp(): Promise<E2EApp> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useValue({ sendPasswordReset: jest.fn().mockResolvedValue(undefined) })
    // Отключаем rate limiting в e2e-тестах — иначе beforeEach-регистрации
    // превышают лимит @Throttle(5 req/60s) на auth-эндпоинтах.
    // ThrottlerStorage — Symbol-токен хранилища счётчиков, мокаем increment чтобы
    // никогда не блокировать запросы (isBlocked всегда false).
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: jest.fn().mockResolvedValue({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    })
    .compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = moduleFixture.get(PrismaService);

  return {
    app,
    prisma,
    close: () => app.close(),
  };
}

/**
 * Очищает тестовые данные в правильном порядке (с учётом FK-зависимостей).
 * Вызывается в beforeEach каждого test suite.
 */
export async function cleanDb(prisma: PrismaService): Promise<void> {
  await prisma.userSource.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.userArticle.deleteMany();
  await prisma.article.deleteMany();
  await prisma.source.deleteMany();
  await prisma.user.deleteMany();
}
