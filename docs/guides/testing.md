# План написания тестов

## Context

Аудит MVP (issue-32-mvp-audit.md) выставил тестам оценку 2/10. Единственный тест — тривиальный smoke для `HealthController`. Ключевая бизнес-логика (auth, scoring, sync, маперы) не покрыта. Рефакторинг без тестов небезопасен.

Инфраструктура API уже частично готова: Jest 29, `@nestjs/testing`, `supertest`, `ts-jest` установлены.

---

## Блок 1: Unit-тесты (apps/api)

**Что тестируем:** изолированные функции и сервисы с замоканными зависимостями. Без БД, без сети, без NestJS DI-контейнера.

**Библиотеки:** уже установлены — `jest`, `ts-jest`, `@types/jest`.

**Паттерн:**

```typescript
// Прямой инстанс — без NestJS TestingModule
const mockUsersService = { findByEmail: jest.fn(), create: jest.fn() };
const service = new AuthService(
  mockUsersService as unknown as UsersService,
  mockJwtService as unknown as JwtService,
  mockMailService as unknown as MailService,
);
```

Env-переменные: `jest.mock('../config/env', () => ({ getEnv: () => ({ JWT_SECRET: 'test', ... }) }))`.

**Файлы:**

| Новый файл                                     | Что тестирует                 | Ключевые сценарии                                                                                                                                                                                                |
| ---------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/sources/rss-mapper.spec.ts`               | `rss-mapper.ts`               | makeGuid: guid → link → hash-fallback; детерминизм хэша; маппинг полей                                                                                                                                           |
| `src/scoring/scoring.service.spec.ts`          | `scoring.service.ts`          | NEUTRAL при недоступном AI; парсинг JSON; clamp score 0–1; mismatch длины → NEUTRAL; невалидный JSON → NEUTRAL                                                                                                   |
| `src/auth/auth.service.spec.ts`                | `auth.service.ts`             | validateUser: 401 если нет юзера/неверный пароль; register: 409 если email занят; refresh: 403 если нет токена; forgotPassword: молчит при отсутствии юзера; resetPassword: 400 при просроченном/неверном токене |
| `src/scoring/groq.gate.spec.ts`                | `groq.gate.ts`                | null без API-ключа; null при открытом circuit; retry при RateLimitError до MAX_RETRIES; открытие circuit после FAILURE_THRESHOLD ошибок                                                                          |
| `src/sync/sync.service.spec.ts`                | `sync.service.ts`             | пропуск при isRunning=true; сброс isRunning в finally; обход всех источников; продолжение при ошибке одного источника                                                                                            |
| `src/scoring/articles-scoring.service.spec.ts` | `articles-scoring.service.ts` | пропуск при isAvailable=false; пропуск при пустом списке; вызов updateAiContentBatch только для статей с aiContent; ошибка одной статьи не прерывает батч                                                        |

---

## Блок 2: Модульные (integration) тесты (apps/api)

**Что тестируем:** NestJS-модули целиком через `TestingModule` — с реальным DI, но с замоканным `PrismaService` (реальная БД не нужна). Проверяем взаимодействие контроллер → сервис → репозиторий.

**Библиотеки:** `@nestjs/testing` (уже установлен). Для мока Prisma: `jest-mock-extended` (нужно добавить) — генерирует типизированные моки для любого класса автоматически.

```bash
pnpm --filter @repo/api add -D jest-mock-extended
```

**Паттерн:**

```typescript
import { mockDeep } from 'jest-mock-extended';

const prismaMock = mockDeep<PrismaClient>();

const module = await Test.createTestingModule({
  providers: [
    AuthService,
    UsersService,
    UsersRepository,
    { provide: PrismaService, useValue: prismaMock },
    { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
  ],
}).compile();
```

**Файлы:**

| Новый файл                                   | Что тестирует        | Ключевые сценарии                                                                      |
| -------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| `src/auth/auth.module.spec.ts`               | `AuthModule` целиком | register → bcrypt → сохранение → токены; login → токены → обновление refreshToken в БД |
| `src/feed/feed.module.spec.ts`               | `FeedModule`         | getFeed с пагинацией; фильтрация по threshold; cursor-based навигация                  |
| `src/sources/sources.module.spec.ts`         | `SourcesModule`      | addSource: дублирование → 409; добавление и активация; удаление деактивирует           |
| `src/preferences/preferences.module.spec.ts` | `PreferencesModule`  | getSettings создаёт дефолт если нет записи; updateSettings merge-логика                |

---

## Блок 3: E2E-тесты (apps/api)

**Что тестируем:** HTTP-запросы к реально поднятому приложению против тестовой БД. Проверяем весь стек от роутера до Prisma.

**Библиотеки:** `supertest` (уже установлен), `@nestjs/testing` (уже установлен). Требуется отдельная тестовая БД (например, отдельный Docker-контейнер или `DATABASE_URL` из `.env.test`).

**Паттерн:**

```typescript
// apps/api/test/auth.e2e-spec.ts
const app = await Test.createTestingModule({ imports: [AppModule] }).compile();
const server = app.getHttpAdapter().getInstance();

await supertest(server)
  .post('/auth/register')
  .send({ email: 'test@test.com', password: 'Password1!' })
  .expect(201);
```

**Файлы:**

| Новый файл                 | Что тестирует | Ключевые сценарии                                                                                               |
| -------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| `test/auth.e2e-spec.ts`    | `/auth/*`     | POST /register → 201 + токены; POST /login → 200; повторный register → 409; GET /auth/me с невалидным JWT → 401 |
| `test/sources.e2e-spec.ts` | `/sources/*`  | GET /sources → пустой список; POST /sources → 201; POST повторно → 409; DELETE → 204                            |
| `test/feed.e2e-spec.ts`    | `/feed`       | GET /feed без авторизации → 401; GET /feed → 200 + структура FeedPage                                           |

Конфиг: `apps/api/test/jest-e2e.json` уже существует, нужно лишь добавить `setupFilesAfterFramework` для сброса БД между тестами.

---

## Блок 4: Компонентные тесты (apps/web) — опционально

**Статус:** инфраструктура не установлена.

**Что тестируем:** React-компоненты изолированно, без реального API.

**Библиотеки (нужно добавить):**

```bash
pnpm --filter @repo/web add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom
```

Vitest предпочтительнее Jest для Next.js: нативная поддержка ESM, быстрее, совместим с Vite-экосистемой.

**Приоритетные компоненты:**

- `add-source-form.tsx` — валидация URL/Telegram
- `feed-page` — рендер с данными и в пустом состоянии
- Компоненты из `packages/ui` — базовые элементы

---

## Блок 5: Browser E2E-тесты (Playwright)

**Что тестируем:** полные пользовательские сценарии в реальном браузере — от UI до API до БД. Самый медленный и хрупкий тип, но покрывает критические user-flows.

**Библиотеки (нужно добавить):**

```bash
pnpm add -D -w @playwright/test
npx playwright install --with-deps chromium
```

Размещение: отдельный пакет `apps/e2e/` с собственным `playwright.config.ts`, чтобы не смешивать с Jest.

**Конфиг (`playwright.config.ts`):**

```typescript
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3001', // apps/web
  },
  webServer: [
    {
      command: 'pnpm --filter @repo/api start',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
    },
    {
      command: 'pnpm --filter @repo/web dev',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
    },
  ],
});
```

**Файлы:**

| Новый файл                  | Сценарии                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `tests/auth.spec.ts`        | Регистрация → редирект на фид; логин с неверным паролем → сообщение об ошибке; выход из системы          |
| `tests/sources.spec.ts`     | Добавление RSS-источника через форму; отображение фавиконки и названия; удаление источника               |
| `tests/feed.spec.ts`        | Фид пуст до добавления источников; после синхронизации появляются карточки статей; пагинация (load more) |
| `tests/preferences.spec.ts` | Изменение порога релевантности; выбор категорий влияет на отображение фида                               |

**Паттерн с Page Object Model:**

```typescript
// tests/pages/login.page.ts
export class LoginPage {
  constructor(private page: Page) {}
  async login(email: string, password: string) {
    await this.page.fill('[name=email]', email);
    await this.page.fill('[name=password]', password);
    await this.page.click('[type=submit]');
  }
}
```

**Запуск:**

```bash
pnpm --filter @repo/e2e test              # все браузерные e2e
pnpm --filter @repo/e2e test --ui         # интерактивный режим
pnpm --filter @repo/e2e test --headed     # с видимым браузером
```

---

## Порядок реализации

1. **Блок 1** (unit) — высокий приоритет, нет новых зависимостей, максимальная ценность
2. **Блок 2** (модульные) — добавить `jest-mock-extended`, покрыть модули
3. **Блок 3** (api e2e) — требует тестовой БД, настроить CI-окружение
4. **Блок 5** (Playwright) — покрывает критические user-flows, запускается в CI отдельным шагом
5. **Блок 4** (компонентные) — низший приоритет, Playwright уже закрывает большинство UI-сценариев

---

## Команды запуска

```bash
pnpm --filter @repo/api test              # unit + модульные
pnpm --filter @repo/api test:e2e          # api e2e
pnpm --filter @repo/api test --coverage   # покрытие
pnpm --filter @repo/api typecheck         # типизация тестов
pnpm --filter @repo/e2e test              # playwright
pnpm --filter @repo/e2e test --ui         # playwright UI-режим
```
