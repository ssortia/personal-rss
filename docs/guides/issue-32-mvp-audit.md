# Аудит MVP — Curio (issue #32)

**Дата:** 2026-03-25
**Область:** `apps/api`, `packages/types`, `.env.example`, `prisma/schema.prisma`

---

## Итоговая таблица

| #   | Критерий                  | Статус          | Оценка |
| --- | ------------------------- | --------------- | ------ |
| 1   | Архитектура NestJS        | ✅ Хорошо       | 9/10   |
| 2   | Типизация                 | ✅ Хорошо       | 9/10   |
| 3   | Валидация входящих данных | ✅ Отлично      | 10/10  |
| 4   | Обработка ошибок          | ✅ Хорошо       | 8/10   |
| 5   | Дублирование кода         | ✅ Хорошо       | 8/10   |
| 6   | Схема БД                  | ✅ Отлично      | 10/10  |
| 7   | Тесты                     | ❌ Недостаточно | 2/10   |
| 8   | Swagger-документация      | ✅ Хорошо       | 8/10   |
| 9   | ENV-переменные            | ⚠️ Замечание    | 7/10   |

**Общий рейтинг: 7.8/10**

---

## 1. Архитектура NestJS

**Статус: ✅ Хорошо**

Структура модулей правильная: каждый модуль содержит контроллер, сервис и репозиторий (где уместно). Инъекция зависимостей корректна, глобальные модули (`PrismaModule`, `MailModule`, `LoggerModule`) вынесены правильно.

Особо выделяется Gate-паттерн для внешних API — `GroqGate` и `TelegramGate` изолируют сетевые зависимости от бизнес-логики. `BaseRepository` (`.../common/repository/base.repository.ts`) исключает дублирование CRUD-операций.

---

## 2. Типизация

**Статус: ✅ Хорошо**

`any` практически отсутствует. Найдено два случая:

| Файл                                                | Строка | Описание                                                                         |
| --------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `apps/api/src/app.module.ts`                        | 26     | `} as any` — конфигурация pino-http LoggerModule                                 |
| `apps/api/src/common/repository/base.repository.ts` | 32     | `prisma.user as unknown as BaseModelDelegate<…>` — ограничение дженериков Prisma |

Оба случая обоснованы техническими ограничениями, но первый можно устранить, задав явный тип конфига pino-http.

Пакет `packages/types/src/` корректно использует Zod для runtime-валидации на границах API.

---

## 3. Валидация входящих данных

**Статус: ✅ Отлично**

Глобальный `ValidationPipe` (`apps/api/src/main.ts`, строки 16–22) настроен строго:

```typescript
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
```

Все DTO защищены `class-validator`. Примеры:

- `auth/dto/login.dto.ts` — `@IsEmail`, `@MinLength(8)`
- `sources/dto/add-source.dto.ts` — `@IsUrl` с `require_protocol: true`
- `articles/dto/get-feed.dto.ts` — `@Min(1)`, `@Max(50)` для лимита
- `preferences/dto/update-preferences.dto.ts` — `@Min(0)`, `@Max(1)` для порога

Пробелов не обнаружено.

---

## 4. Обработка ошибок

**Статус: ✅ Хорошо**

HTTP-исключения используются единообразно: `BadRequestException`, `ConflictException`, `NotFoundException`, `ForbiddenException`. Логирование ошибок присутствует в сервисах, внешние ошибки не раскрываются клиенту.

**Замечания:**

| Файл                                | Строка | Проблема                                    |
| ----------------------------------- | ------ | ------------------------------------------- |
| `apps/api/src/sync/sync.service.ts` | 150    | `throw new Error(…)` вместо `HttpException` |

Нет глобального `ExceptionFilter` — ошибки обрабатываются стандартным NestJS-фильтром. Для MVP приемлемо, для продакшена рекомендуется добавить кастомный фильтр для унификации формата ответа.

---

## 5. Дублирование кода

**Статус: ✅ Хорошо**

DRY соблюдается через:

- `BaseRepository` — общие CRUD-методы
- `rss-mapper.ts` — `mapRssFeedItems()` переиспользуется в sync и sources
- Gate-паттерн — изолирует внешние API

Незначительное пересечение: логика «fetch → сохранить статьи» повторяется в `sources.service.ts` (строки 64–70) и `sync.service.ts` (строки 129–136), но контексты разные (добавление vs плановая синхронизация), вынесение нецелесообразно.

---

## 6. Схема БД

**Статус: ✅ Отлично**

Индексы настроены для всех частых запросов:

| Модель            | Индексы                                                     |
| ----------------- | ----------------------------------------------------------- |
| `User`            | `@@index([role])`, `@@index([createdAt])`                   |
| `UserSource`      | `@@unique([userId, sourceId])`, `@@index([userId])`         |
| `Article`         | `@@unique([sourceId, guid])`, `@@index([sourceId])`         |
| `UserArticle`     | `@@unique([userId, articleId])`, `@@index([userId, score])` |
| `UserPreferences` | `@@unique([userId, sourceId])`, `@@index([userId])`         |

Каскадное удаление (`onDelete: Cascade`) настроено корректно. Именование: snake_case для таблиц (`@@map`), camelCase для полей. JSONB-поле `settings` в `UserPreferences` — правильный выбор для гибких структур.

---

## 7. Тесты

**Статус: ❌ Недостаточно**

Обнаружен **1 тест-файл**: `apps/api/src/health/health.controller.spec.ts` (тривиальный smoke-тест).

Ключевая бизнес-логика **без покрытия**:

| Модуль                               | Что нужно покрыть                                         |
| ------------------------------------ | --------------------------------------------------------- |
| `auth/auth.service`                  | `validateUser`, `login`, `refreshTokens`, `resetPassword` |
| `sources/sources.service`            | `addSource`, `addTelegramChannel`, `scoreArticlesForUser` |
| `sync/sync.service`                  | `syncAllSources`, логика обновления                       |
| `articles/articles.repository`       | `getFeed` с фильтрацией, `updateAiContent`                |
| `preferences/preferences.repository` | `getSettings`, `updateSettings`, merge-логика             |
| `scoring/scoring.service`            | парсинг ответа Groq, батчинг                              |

**Приоритет — высокий.** Без тестов рефакторинг бизнес-логики небезопасен.

---

## 8. Swagger-документация

**Статус: ✅ Хорошо**

`@ApiOperation` и `@ApiTags` присутствуют на всех эндпоинтах. `@ApiBearerAuth()` на защищённых маршрутах. Swagger UI доступен по `/api/docs`.

**Замечание:** `@ApiResponse` для кодов ошибок (400, 401, 404, 409) отсутствует на большинстве контроллеров. Добавить в:

- `sources/sources.controller.ts` — все методы
- `articles/articles.controller.ts` — все методы
- `users/users.controller.ts` — PUT, PATCH, DELETE методы
- `preferences/preferences.controller.ts` — все методы

---

## 9. ENV-переменные

**Статус: ⚠️ Замечание**

Все переменные из `apps/api/src/env.ts` присутствуют в `.env.example`.

**Проблема — рассинхронизация документации:**

| Переменная  | `.env.example` | `env.ts` | README / CLAUDE.md | Статус                                                   |
| ----------- | :------------: | :------: | :----------------: | -------------------------------------------------------- |
| `REDIS_URL` |       ✅       |    ❌    |         ✅         | Redis упомянут в документации, но в коде не используется |

`README.md` (строка 63) и `CLAUDE.md` ссылаются на `REDIS_URL`, но `env.ts` её не валидирует и ни один модуль не использует. Нужно либо убрать из документации, либо подключить Redis (если планируется).

---

## Итоги и план действий

### Критические (блокируют продакшен)

- [ ] **Написать unit-тесты** для `AuthService`, `SourcesService`, `SyncService`, `ArticlesRepository` (#32)

### Высокий приоритет

- [ ] Добавить `@ApiResponse` для кодов ошибок на всех контроллерах
- [ ] Синхронизировать `REDIS_URL` в документации: убрать из README / CLAUDE.md или подключить Redis

### Средний приоритет

- [ ] Добавить глобальный `ExceptionFilter` для унификации формата ошибок
- [ ] Заменить `throw new Error()` на `HttpException` в `sync.service.ts:150`
- [ ] Улучшить типизацию конфига pino-http в `app.module.ts:26`

### Хорошие практики (сохранить)

- ✅ Gate-паттерн для внешних API
- ✅ Zod для runtime-валидации в `packages/types`
- ✅ JSONB в `UserPreferences.settings`
- ✅ Cursor-based пагинация в `getFeed`
- ✅ Идемпотентный `updateAiContent` через `updateMany` с null-проверкой
- ✅ Глобальный `ValidationPipe` с `whitelist: true`
