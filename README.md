# Curio

Сервис персонального RSS-агрегатора с AI-фильтрацией новостей.

Парсит RSS-ленты и Telegram-каналы, оценивает каждую статью с помощью LLM по заданным пользователем интересам и публикует персональный RSS-фид из релевантных материалов. Читать можно в любом RSS-ридере или через Telegram-бота.

---

## Как это работает

1. **Сбор** — планировщик периодически обходит источники: RSS-ленты и Telegram-каналы
2. **Фильтрация** — LLM оценивает каждую новость по заданным пользователем предпочтениям и интересам
3. **Публикация** — отобранные материалы отдаются в виде стандартного RSS-фида, который можно подключить к любому читалке

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
- **Очереди** — Redis + Bull для фоновой обработки статей
- **Docker** — полный compose для локальной разработки и продакшена

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
| Очереди/кэш        | Redis + Bull                | —      |
| UI-компоненты      | shadcn/ui + Tailwind CSS v4 | —      |
| AI                 | Groq API                    | —      |
| Валидация          | Zod + class-validator       | —      |
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
cp .env.example .env
# Заполнить: DATABASE_URL, REDIS_URL, GROQ_API_KEY

# 4. Запустить PostgreSQL и Redis
docker compose up -d

# 5. Подготовить БД
pnpm --filter @repo/api db:generate
pnpm --filter @repo/api db:migrate
pnpm --filter @repo/api db:seed

# 6. Запустить проект
pnpm dev
```

После запуска:

- Web (управление источниками и предпочтениями): http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs
- Персональный RSS-фид: http://localhost:3001/feed.xml

---

## Структура проекта

```
apps/
  api/          # NestJS — парсинг, AI-фильтрация, генерация RSS-фида
  web/          # Next.js 15 — управление источниками, предпочтениями, просмотр фида
packages/
  types/        # Общие Zod-схемы и TypeScript-типы
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

| Переменная            | Описание                               |
| --------------------- | -------------------------------------- |
| `DATABASE_URL`        | Строка подключения к PostgreSQL        |
| `REDIS_URL`           | Строка подключения к Redis             |
| `GROQ_API_KEY`        | API-ключ Groq                          |
| `TELEGRAM_API_ID`     | Telegram App ID (для парсинга каналов) |
| `TELEGRAM_API_HASH`   | Telegram App Hash                      |
| `JWT_SECRET`          | Секрет для JWT-токенов                 |
| `NEXTAUTH_SECRET`     | Секрет для next-auth                   |
| `NEXT_PUBLIC_API_URL` | URL API для браузера                   |

---

## Команды

```bash
pnpm dev                                    # запустить всё в dev-режиме
pnpm build                                  # собрать все пакеты
pnpm lint                                   # ESLint по всему монорепо
pnpm typecheck                              # TypeScript проверка типов
pnpm test                                   # запустить тесты

# База данных
pnpm --filter @repo/api db:generate         # сгенерировать Prisma Client
pnpm --filter @repo/api db:migrate          # создать/применить миграции
pnpm --filter @repo/api db:seed             # заполнить начальными данными
pnpm --filter @repo/api db:studio           # открыть Prisma Studio

# Docker
docker compose up -d                        # запустить PostgreSQL и Redis локально
docker compose down                         # остановить
```

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
