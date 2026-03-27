# Curio

Сервис персонального RSS-агрегатора с AI-фильтрацией новостей.

Парсит RSS-ленты и Telegram-каналы, оценивает каждую статью с помощью LLM по заданным пользователем интересам и публикует персональный RSS-фид из релевантных материалов. Читать можно в любом RSS-ридере или через Telegram-бота.

---

## Как это работает

1. **Сбор** — планировщик периодически обходит источники: RSS-ленты и Telegram-каналы
2. **Фильтрация** — LLM оценивает каждую новость по заданным пользователем предпочтениям и интересам
3. **Публикация** — отобранные материалы отдаются в виде стандартного RSS-фида, который можно подключить к любой читалке

---

## Возможности

- **Источники** — произвольные RSS/Atom-ленты + Telegram-каналы (через MTProto или публичный preview)
- **AI-фильтрация** — интеграция с Groq API для оценки релевантности статей
- **Настройка предпочтений** — описание интересов в свободной форме; LLM ориентируется на них при отборе
- **Персональный RSS** — стандартный RSS 2.0-фид с отобранными новостями
- **Монорепо** — pnpm workspaces + Turborepo
- **API** — NestJS 11 + Fastify, Swagger UI
- **Web** — Next.js 15 App Router, shadcn/ui, Tailwind CSS v4
- **БД** — Prisma 6 + PostgreSQL (хранение источников, статей, оценок)
- **Docker** — compose для локальной разработки

---

## Стек

| Категория          | Технология                  | Версия |
| ------------------ | --------------------------- | ------ |
| Пакетный менеджер  | pnpm                        | 9+     |
| Оркестрация сборок | Turborepo                   | latest |
| Backend            | NestJS                      | 11     |
| HTTP-адаптер       | Fastify                     | —      |
| Frontend           | Next.js                     | 15     |
| ORM                | Prisma                      | 6      |
| База данных        | PostgreSQL                  | 16     |
| UI-компоненты      | shadcn/ui + Tailwind CSS v4 | —      |
| AI                 | Groq API                    | —      |
| Валидация          | Zod + class-validator       | —      |
| E2E тесты          | Playwright                  | 1.51   |
| TypeScript         | —                           | 5.7    |
| Node.js            | —                           | 22+    |

---

## Быстрый старт

```bash
# 1. Клонировать и перейти в директорию
git clone <url> && cd personal-rss

# 2. Установить зависимости
pnpm install

# 3. Настроить переменные окружения
cp .env.example .env            # для docker compose
cp .env.example apps/api/.env   # для локального запуска API (удали web-переменные)
cp .env.example apps/web/.env   # для локального запуска Web (удали api-переменные)
# Заполнить: GROQ_API_KEY, секреты JWT и NEXTAUTH

# 4. Запустить PostgreSQL
docker compose up -d

# 5. Подготовить БД
pnpm --filter @repo/api db:generate
pnpm --filter @repo/api db:migrate

# 6. Запустить проект
pnpm dev
```

После запуска:

- Web: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs

---

## Структура проекта

```
apps/
  api/          # NestJS — парсинг, AI-фильтрация, генерация RSS-фида
  web/          # Next.js 15 — управление источниками, предпочтениями, просмотр фида
  e2e/          # Playwright E2E тесты
packages/
  shared/       # Общие Zod-схемы и TypeScript-типы (api + web)
  config/
    eslint/     # ESLint flat config
    typescript/ # tsconfig базы
    prettier/   # Prettier конфиг
docker/
  api.Dockerfile
  web.Dockerfile
  nginx.conf
```

---

## Переменные окружения

Переменные разделены по приложениям. Подробнее — в `.env.example`.

| Переменная            | Приложение | Описание                                     |
| --------------------- | ---------- | -------------------------------------------- |
| `DATABASE_URL`        | api        | Строка подключения к PostgreSQL              |
| `JWT_SECRET`          | api        | Секрет для access-токенов (мин. 32 символа)  |
| `JWT_REFRESH_SECRET`  | api        | Секрет для refresh-токенов (мин. 32 символа) |
| `GROQ_API_KEY`        | api        | API-ключ Groq для AI-оценки статей           |
| `SMTP_HOST`           | api        | SMTP-хост для отправки писем                 |
| `APP_URL`             | api        | URL фронтенда (используется в письмах)       |
| `NEXTAUTH_SECRET`     | web        | Секрет для next-auth (мин. 32 символа)       |
| `NEXTAUTH_URL`        | web        | Публичный URL фронтенда                      |
| `NEXT_PUBLIC_API_URL` | web        | URL API для браузера                         |
| `API_URL`             | web        | URL API для server-side запросов             |

---

## Команды

```bash
pnpm dev                                    # запустить всё в dev-режиме
pnpm build                                  # собрать все пакеты
pnpm lint                                   # ESLint по всему монорепо
pnpm typecheck                              # TypeScript проверка типов
pnpm test                                   # unit и integration тесты

# База данных
pnpm --filter @repo/api db:generate         # сгенерировать Prisma Client
pnpm --filter @repo/api db:migrate          # создать/применить миграции
pnpm --filter @repo/api db:seed             # заполнить начальными данными
pnpm --filter @repo/api db:studio           # открыть Prisma Studio

# Docker
docker compose up -d                        # запустить PostgreSQL локально
docker compose down                         # остановить
```

---

## Тестирование

### Unit и integration тесты (Jest)

```bash
pnpm test                                   # все тесты
pnpm --filter @repo/api test                # только API
```

### E2E тесты (Playwright)

Перед первым запуском установить браузер:

```bash
pnpm --filter @repo/e2e exec playwright install chromium
```

Запустить тесты (Playwright сам поднимет API и Web через production-сборку):

```bash
pnpm build                                  # нужен production-билд
pnpm --filter @repo/e2e e2e                 # запустить все E2E тесты
pnpm --filter @repo/e2e e2e:ui              # интерактивный UI-режим
pnpm --filter @repo/e2e exec playwright test --headed  # видимый браузер
```

Покрытие:

- **auth** — регистрация, логин, редиректы, выход
- **sources** — добавление источников, валидация URL
- **feed** — загрузка фида, RSS-виджет
- **preferences** — slider релевантности, textarea интересов

---

## Документация

| Документ                                                                                     | Описание                        |
| -------------------------------------------------------------------------------------------- | ------------------------------- |
| [docs/PRODUCT.md](./docs/PRODUCT.md)                                                         | Продуктовое описание сервиса    |
| [docs/USER_STORIES.md](./docs/USER_STORIES.md)                                               | User stories                    |
| [docs/adr/009-rss-aggregator-architecture.md](./docs/adr/009-rss-aggregator-architecture.md) | Архитектурное решение (ADR-009) |

---

## Лицензия

MIT
