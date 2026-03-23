# NexST Template

Продакшен-готовый монорепо-шаблон для полностековых проектов на **NestJS + Next.js**.

---

## Возможности

- **Монорепо** — pnpm workspaces + Turborepo с кэшированием сборок
- **API** — NestJS 11 с Fastify-адаптером, SWC-компилятором и Swagger UI
- **JWT-аутентификация** — login / refresh / logout с хранением хэша refresh-токена в БД
- **Web** — Next.js 15 App Router с защищёнными маршрутами через next-auth v5
- **UI** — shadcn/ui компоненты в `apps/web/src/components/ui` на Tailwind CSS v4
- **Тёмная тема** — next-themes с переключателем в хедере, сохранение в localStorage, поддержка системных настроек
- **Общие типы** — Zod-схемы в `@repo/types`, используемые и на API, и на фронте
- **БД** — Prisma 6 + PostgreSQL, миграции и seed из коробки
- **Строгий TypeScript** — strict mode везде, включая `noUncheckedIndexedAccess`
- **Линтинг** — ESLint v9 flat config с раздельными правилами для NestJS и Next.js
- **Docker** — multistage Dockerfile для API и Web, nginx-прокси, prod compose
- **CI** — GitHub Actions: lint → typecheck → test → build

---

## Стек

| Категория            | Технология                  | Версия    |
| -------------------- | --------------------------- | --------- |
| Пакетный менеджер    | pnpm                        | 9+        |
| Оркестрация сборок   | Turborepo                   | latest    |
| Backend              | NestJS                      | 11        |
| HTTP-адаптер         | Fastify                     | —         |
| Frontend             | Next.js                     | 15        |
| Аутентификация (web) | next-auth                   | v5 (beta) |
| ORM                  | Prisma                      | 6         |
| База данных          | PostgreSQL                  | 16        |
| UI-компоненты        | shadcn/ui + Tailwind CSS v4 | —         |
| Валидация            | Zod + class-validator       | —         |
| TypeScript           | —                           | 5.7       |
| Node.js              | —                           | 22+       |

---

## Быстрый старт

```bash
# 1. Клонировать и перейти в директорию
git clone <url> && cd nexst-template

# 2. Установить зависимости
pnpm install

# 3. Настроить переменные окружения
cp .env.example .env
# Отредактировать .env: задать JWT_SECRET, NEXTAUTH_SECRET (min 32 символа)

# 4. Запустить PostgreSQL
docker compose up -d db

# 5. Подготовить БД
pnpm --filter @repo/api db:generate  # сгенерировать Prisma Client
pnpm --filter @repo/api db:migrate   # применить миграции
pnpm --filter @repo/api db:seed      # создать пользователя admin@example.com / admin123456

# 6. Запустить проект
pnpm dev
```

После запуска:

- Web: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs

> **Примечание.** `.env` хранится в корне монорепо и является единым источником переменных.
> Все скрипты пакетов обращаются к нему явно — дублировать файл по пакетам не нужно.

Подробнее: [docs/guides/getting-started.md](./docs/guides/getting-started.md)

---

## Структура проекта

```
apps/
  api/          # NestJS (Fastify, SWC, JWT auth, Swagger, Prisma)
  web/          # Next.js 15 (App Router, next-auth v5, shadcn/ui)
packages/
  types/        # Общие Zod-схемы и TypeScript-типы
  config/
    eslint/     # ESLint flat config (base, nestjs, nextjs)
    typescript/ # tsconfig базы (base, nestjs, nextjs)
    prettier/   # Prettier конфиг
docker/
  api.Dockerfile
  web.Dockerfile
  nginx.conf
```

---

## Команды

```bash
pnpm dev                                    # запустить всё в dev-режиме
pnpm build                                  # собрать все пакеты
pnpm lint                                   # ESLint по всему монорепо
pnpm typecheck                              # TypeScript проверка типов
pnpm test                                   # запустить тесты
pnpm format                                 # Prettier форматирование

# База данных
pnpm --filter @repo/api db:generate         # сгенерировать Prisma Client
pnpm --filter @repo/api db:migrate          # создать/применить миграции
pnpm --filter @repo/api db:seed             # заполнить тестовыми данными
pnpm --filter @repo/api db:studio           # открыть Prisma Studio

# Docker
docker compose up -d                        # запустить PostgreSQL локально
docker compose down                         # остановить
```

---

## Документация

| Документ                                                           | Описание                               |
| ------------------------------------------------------------------ | -------------------------------------- |
| [docs/DOCUMENTATION.md](./docs/DOCUMENTATION.md)                   | Правила ведения документации в проекте |
| [docs/guides/getting-started.md](./docs/guides/getting-started.md) | Локальная установка шаг за шагом       |
| [docs/guides/development.md](./docs/guides/development.md)         | Ежедневный workflow разработчика       |
| [docs/guides/adding-a-module.md](./docs/guides/adding-a-module.md) | Добавление новой бизнес-сущности       |
| [docs/guides/deployment.md](./docs/guides/deployment.md)           | Деплой в продакшен                     |
| [docs/adr/](./docs/adr/)                                           | Архитектурные решения (ADR)            |
| [CLAUDE.md](./CLAUDE.md)                                           | Инструкции для AI-ассистента           |

---

## Лицензия

MIT
