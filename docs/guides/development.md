# Ежедневная разработка

**Цель:** справочник по командам и процессам, которые используются в работе каждый день.

---

## Запуск

### Всё сразу

```bash
pnpm dev
```

Запускает API (порт 3001) и Web (порт 3000) параллельно через Turborepo.

### Только один сервис

```bash
pnpm --filter @repo/api dev    # только API
pnpm --filter @repo/web dev    # только Web
```

### База данных

```bash
docker compose up -d   # запустить PostgreSQL
docker compose down    # остановить
docker compose ps      # статус контейнеров
```

### Запуск в Docker с HMR

Для полноценной разработки внутри Docker (с горячей перезагрузкой):

```bash
docker compose up --build
```

- Исходный код монтируется с хоста — изменения применяются без пересборки образа
- API перезапускается при изменении `.ts`-файлов (`nest --watch`)
- Web обновляется через HMR (Turbopack)
- При изменении типов в `@repo/shared` — перезапустить контейнеры:

```bash
docker compose restart api web
```

---

## Сборка

```bash
pnpm build                        # собрать всё
pnpm --filter @repo/api build     # только API
pnpm --filter @repo/web build     # только Web
```

Turborepo кэширует результаты. Повторная сборка без изменений — мгновенная.

---

## Проверка кода

```bash
pnpm lint           # ESLint по всему монорепо
pnpm typecheck      # TypeScript проверка типов
pnpm format         # Prettier форматирование
```

Запустить только для одного пакета:

```bash
pnpm --filter @repo/api lint
pnpm --filter @repo/web typecheck
```

---

## Тесты

```bash
pnpm test                          # все тесты
pnpm --filter @repo/api test       # unit-тесты API
pnpm --filter @repo/api test:e2e   # e2e тесты API (требует БД)
pnpm --filter @repo/e2e e2e        # Playwright E2E тесты (требует production-сборки)
```

---

## База данных

```bash
# Создать новую миграцию после изменения schema.prisma
pnpm --filter @repo/api db:migrate

# Применить миграции без создания новых (CI / продакшен)
pnpm --filter @repo/api db:migrate:deploy

# Заполнить тестовыми данными
pnpm --filter @repo/api db:seed

# Открыть Prisma Studio (GUI для БД)
pnpm --filter @repo/api db:studio
```

---

## Swagger / API docs

Swagger UI доступен при запущенном API:

```
http://localhost:3001/api/docs
```

Для тестирования защищённых эндпоинтов:

1. Выполни `POST /auth/login` — получи `accessToken`
2. Нажми кнопку «Authorize» (🔒) вверху страницы
3. Вставь `accessToken` в поле `BearerAuth`

---

## Переменные окружения

Переменные хранятся в `.env`-файлах (не коммитятся). Пример — в `.env.example`.

При добавлении новой переменной:

1. Добавь в `.env.example` с комментарием и примером значения
2. Добавь валидацию в `apps/api/src/config/env.ts` (для API) или в `src/env.ts` (для Web)
3. Обнови таблицу в `CLAUDE.md`

---

## Структура модулей API

```
apps/api/src/
├── config/         ← env.ts (валидация переменных окружения)
├── prisma/         ← PrismaService (глобальный модуль)
├── common/         ← BaseRepository (общая логика репозиториев)
├── auth/           ← JWT auth: login, refresh, logout, сброс пароля
│   ├── dto/        ← DTO классы (class-validator)
│   ├── guards/     ← JwtAuthGuard, JwtRefreshGuard
│   └── strategies/ ← Passport стратегии
├── users/          ← CRUD пользователей, GET /users/me
├── sources/        ← Управление источниками (RSS/Atom, Telegram), маппер RSS
├── articles/       ← Статьи с оценками, GET /articles
├── feed/           ← Персональный RSS-фид, управление токеном
├── scoring/        ← AI-оценка статей через GroqGate
├── preferences/    ← Настройки пользователя (глобальные + per-source)
├── sync/           ← Планировщик обхода источников, ручной запуск
├── telegram/       ← TelegramGate для парсинга постов каналов
├── mail/           ← Email-рассылка (сброс пароля)
└── health/         ← GET /health
```

---

## Структура роутинга Web

```
apps/web/src/app/
├── (auth)/
│   ├── login/page.tsx           ← /login
│   ├── register/page.tsx        ← /register
│   ├── forgot-password/page.tsx ← /forgot-password
│   └── reset-password/page.tsx  ← /reset-password (с токеном из email)
├── (dashboard)/
│   ├── layout.tsx               ← защищённый layout (проверяет auth())
│   ├── page.tsx                 ← / (фид отобранных статей)
│   ├── sources/page.tsx         ← /sources (управление источниками)
│   └── preferences/page.tsx     ← /preferences (настройки фильтрации)
├── admin/
│   ├── page.tsx                 ← /admin
│   └── users/page.tsx           ← /admin/users (управление пользователями)
└── api/auth/[...nextauth]/      ← NextAuth обработчики
    └── route.ts
```

Middleware (`src/middleware.ts`) защищает все маршруты кроме `/login`, `/register`, `/api/*` и статики.

---

## Shared пакеты

| Пакет                     | Что экспортирует                     | Кто использует    |
| ------------------------- | ------------------------------------ | ----------------- |
| `@repo/shared`            | Zod-схемы и TypeScript-типы для DTO  | API, Web          |
| `src/components/ui`       | shadcn/ui компоненты, `cn()` утилита | Внутри `apps/web` |
| `@repo/typescript-config` | tsconfig базы (base, nestjs, nextjs) | Все               |
| `@repo/eslint-config`     | ESLint конфиги                       | Все               |
| `@repo/prettier-config`   | Prettier конфиг                      | Все               |

---

## Полезные команды

```bash
# Очистить кэш Turborepo
pnpm turbo clean

# Посмотреть граф зависимостей задач
pnpm turbo build --graph

# Запустить команду только для изменённых пакетов
pnpm turbo build --filter=[HEAD^1]

# Обновить зависимости интерактивно
pnpm update --interactive --recursive
```
