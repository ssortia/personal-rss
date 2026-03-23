# ADR-009: Архитектура RSS-агрегатора с AI-фильтрацией

**Статус:** принято
**Дата:** 2026-03-23

---

## Контекст

Сервис агрегирует RSS-ленты и Telegram-каналы, фильтрует новости через Groq API по предпочтениям пользователя и отдаёт персональный RSS-фид. Сервис мульти-тенантный (несколько пользователей).

---

## Решение

**Модульный монолит + Bull/Redis.** Один NestJS-процесс, фоновая обработка через BullMQ-очереди, Telegram через MTProto (gramjs).

---

## Модульная структура API

```
apps/api/src/
├── sources/          — CRUD источников (RSS URL | Telegram-канал)
├── articles/         — хранение, дедупликация, оценки AI
├── preferences/      — интересы пользователя (текст + порог score)
├── parsers/
│   ├── rss/          — парсинг RSS/Atom через rss-parser
│   └── telegram/     — MTProto через gramjs (TelegramClient)
├── ai-filter/        — Groq SDK: оценка релевантности статьи (score 0–1)
├── feed/             — генерация /rss/:userId/feed.xml, кэш в Redis
├── scheduler/        — BullMQ очереди + @nestjs/schedule cron-триггеры
└── ... (auth, users, prisma — уже есть)
```

---

## Схема базы данных (Prisma)

```prisma
enum SourceType { RSS TELEGRAM }

// Глобальный справочник источников — один фетчер на URL
model Source {
  id                   String     @id @default(cuid())
  type                 SourceType
  url                  String     @unique
  title                String
  lastFetchedAt        DateTime?
  fetchIntervalMinutes Int        @default(60)
  createdAt            DateTime   @default(now())

  articles      Article[]
  subscriptions UserSource[]
}

// Подписка пользователя на источник + индивидуальные настройки фильтрации
model UserSource {
  userId    String
  sourceId  String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  // null-поля означают «использовать глобальные UserPreferences»
  interestsText  String?    @db.Text
  scoreThreshold Float?
  categories     Category[]

  user   User   @relation(fields: [userId], references: [id])
  source Source @relation(fields: [sourceId], references: [id])

  @@id([userId, sourceId])
}

// Статья принадлежит источнику; оценка хранится отдельно на каждого пользователя
model Article {
  id          String   @id @default(cuid())
  sourceId    String
  externalId  String   // guid/url для дедупликации
  title       String
  description String?  @db.Text  // краткое описание из RSS
  content     String?  @db.Text  // полный текст для AI-оценки
  url         String
  publishedAt DateTime
  fetchedAt   DateTime @default(now())

  source Source         @relation(fields: [sourceId], references: [id])
  scores ArticleScore[]

  @@unique([sourceId, externalId])
  @@index([publishedAt])
}

// Оценка статьи конкретным пользователем
model ArticleScore {
  articleId      String
  userId         String
  aiScore        Float
  isIncluded     Boolean
  telegramSentAt DateTime? // null = ещё не доставлена в Telegram

  article Article @relation(fields: [articleId], references: [id])
  user    User    @relation(fields: [userId], references: [id])

  @@id([articleId, userId])
  @@index([userId, isIncluded])
}

// Глобальные настройки фильтрации; применяются когда UserSource не переопределяет
model UserPreferences {
  id             String  @id @default(cuid())
  userId         String  @unique
  interestsText  String? @db.Text
  scoreThreshold Float   @default(0.6)

  user       User       @relation(fields: [userId], references: [id])
  categories Category[]
}

// Справочник категорий (заполняется при seed)
model Category {
  id    String @id @default(cuid())
  slug  String @unique  // "technology", "science"
  label String          // "Технологии", "Наука"

  userPreferences UserPreferences[]
  userSources     UserSource[]
}

// Привязка Telegram для ДОСТАВКИ статей пользователю
// (не путать с Source(type=TELEGRAM) — это ЧТЕНИЕ каналов)
model TelegramConnection {
  id               String   @id @default(cuid())
  userId           String   @unique
  telegramUserId   String   @unique
  telegramUsername String?
  connectedAt      DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

Модель `User` расширяется полем `feedToken` для публичного RSS-фида:

```prisma
model User {
  // ... существующие поля
  feedToken String @unique @default(cuid()) // токен для /feed/{feedToken}
}
```

---

## Поток данных

```
@Cron (каждые N минут)
  → для каждого уникального активного Source → ставит задачу в parse-queue

parse-queue: ParseWorker
  → определяет парсер (RSS или Telegram)
  → получает новые записи → сохраняет в Article (дедупликация по externalId)
  → находит всех подписчиков Source через UserSource
  → для каждой новой статьи × каждого подписчика → ставит задачу в filter-queue

filter-queue: AiFilterWorker
  → загружает статью + подписку пользователя (UserSource)
  → resolves фильтр:
      effective = UserSource.interestsText ?? UserPreferences.interestsText
      threshold = UserSource.scoreThreshold ?? UserPreferences.scoreThreshold
      categories = UserSource.categories (если пусто) ?? UserPreferences.categories
  → запрос к Groq API (модель llama-3.3-70b или mixtral)
  → создаёт/обновляет ArticleScore { aiScore, isIncluded }
  → инвалидирует кэш фида пользователя в Redis

GET /feed/:feedToken
  → находит пользователя по feedToken
  → берёт из кэша Redis или генерирует RSS 2.0 XML
      из Article JOIN ArticleScore WHERE userId = ? AND isIncluded = true
```

---

## Ключевые зависимости

| Пакет                     | Назначение         |
| ------------------------- | ------------------ |
| `@nestjs/bull` + `bullmq` | Очереди            |
| `rss-parser`              | Парсинг RSS/Atom   |
| `gramjs`                  | Telegram MTProto   |
| `groq-sdk`                | Groq API           |
| `fast-xml-parser`         | Генерация RSS XML  |
| `ioredis`                 | Redis клиент       |
| `passport-google-oauth20` | OAuth через Google |
| `passport-github2`        | OAuth через GitHub |
| `passport-yandex`         | OAuth через Яндекс |

---

## Переменные окружения (добавить к существующим)

```
REDIS_URL
GROQ_API_KEY
TELEGRAM_API_ID
TELEGRAM_API_HASH
TELEGRAM_SESSION       # строка сессии gramjs (после первого входа)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
YANDEX_CLIENT_ID
YANDEX_CLIENT_SECRET
```

---

## Web-интерфейс (apps/web)

Новые страницы в `(dashboard)/`:

- `/sources` — список источников, добавление/удаление
- `/preferences` — редактирование интересов и порога score
- `/feed` — ссылка на персональный RSS, превью последних статей

---

## Критические файлы для изменения

- `apps/api/prisma/schema.prisma` — добавить Source, Article, UserPreferences
- `apps/api/src/app.module.ts` — зарегистрировать новые модули + BullModule + Redis
- `docker-compose.yml` — добавить сервис redis
- `.env.example` — добавить новые переменные
- `packages/types/src/index.ts` — добавить Zod-схемы для новых сущностей

---

## Порядок реализации

1. Prisma-схема + миграция (включая seed категорий)
2. Модуль `sources` — глобальный справочник лент
3. Модуль `user-sources` — подписки + индивидуальные фильтры
4. Модуль `preferences` — глобальные настройки пользователя
5. Модуль `articles` + `article-scores`
6. Инфраструктура очередей (BullModule + Redis)
7. Парсер RSS (`rss-parser`)
8. Парсер Telegram (`gramjs`)
9. AI-фильтрация (`groq-sdk`) с resolve-логикой фильтров
10. Генерация RSS-фида по `feedToken` + кэш
11. Scheduler (cron-триггеры)
12. Web-страницы управления

---

## Обоснование выбора

- Один процесс = один Docker-контейнер, проще деплой
- BullMQ даёт retry, приоритеты, мониторинг без отдельного сервиса
- gramjs — наиболее зрелая MTProto-библиотека для Node.js
- Groq API — бесплатный tier с быстрым inference для фильтрации
