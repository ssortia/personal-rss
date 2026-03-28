# 013. OAuth-аутентификация через сторонние провайдеры

**Статус:** Принято

**Дата:** 2026-03-28

## Контекст

Пользователи хотят входить через Google, GitHub и Яндекс без создания отдельного пароля (issue #27). Система уже использует next-auth v5 (Credentials) и NestJS с JWT. Нужно добавить OAuth, не разрушая существующий поток credentials-аутентификации.

## Проблема

OAuth-токены от провайдеров (Google access token) — это не наши API-токены. NestJS API выдаёт собственные JWT. Нужен мост между OAuth-потоком next-auth и JWT-потоком бэкенда.

## Рассмотренные варианты

**Вариант A: next-auth управляет пользователями, NestJS доверяет сессии**

- next-auth хранит пользователей в своей БД (Prisma adapter)
- NestJS принимает токены next-auth как авторитет
- ❌ Дублирование хранилища пользователей (next-auth + NestJS)
- ❌ Сложная синхронизация ролей и профиля

**Вариант B: OAuth dance в NestJS через Passport (passport-google-oauth, etc.)**

- NestJS обрабатывает OAuth redirect напрямую
- ❌ Next.js фронт должен перенаправлять на NestJS API для OAuth
- ❌ Теряем next-auth как middleware-защиту маршрутов
- ❌ Сложнее обрабатывать callback URL в SPA-окружении

**Вариант C: next-auth как OAuth proxy → бэкенд `/auth/oauth`** ✓

- next-auth обрабатывает OAuth dance (redirect, code exchange, profile fetch)
- После получения профиля next-auth `jwt` callback вызывает `POST /auth/oauth`
- Бэкенд создаёт/находит пользователя и возвращает собственные JWT
- next-auth хранит наши JWT в сессии (как при credentials)

## Решение

Выбран **Вариант C**. Единый источник истины о пользователях — NestJS + PostgreSQL. next-auth используется только как OAuth-посредник.

### Детали реализации

**Схема БД:**

- `User.password` → опциональный (`String?`): пользователи OAuth создаются без пароля
- Новая таблица `oauth_accounts`: хранит `provider + providerAccountId → userId`

**Логика `POST /auth/oauth`:**

1. Найти `OAuthAccount(provider, providerAccountId)` → вернуть токены существующего пользователя
2. Нет, но есть `User(email)` → привязать провайдера → вернуть токены
3. Нет ни того, ни другого → создать `User` (без пароля) + `OAuthAccount` → вернуть токены

**Яндекс провайдер:** не входит в built-in список next-auth v5 beta — реализован как кастомный OAuth2 провайдер через API `https://oauth.yandex.ru/`.

**Опциональность:** провайдеры активны только при наличии `CLIENT_ID` + `CLIENT_SECRET` в env. Кнопки скрываются в UI, если ключи не заданы.

## Последствия

### Положительные

- Единая БД пользователей, единые JWT — NestJS остаётся авторитетом
- Существующий credentials-поток без изменений
- Refresh token логика не меняется
- Email из OAuth совпадает с существующим аккаунтом → автоматическая привязка

### Отрицательные / компромиссы

- `POST /auth/oauth` публичен — любой может передать произвольный `{ provider, providerAccountId, email }`; защита — rate limiting (5/min). Для hardened production можно добавить shared secret между web и api.
- OAuth-пользователи без пароля не могут использовать credentials-форму (можно добавить через password reset flow)
- Яндекс требует поддержки в консоли разработчика — не автоматически работает как Google/GitHub
