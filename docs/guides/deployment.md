# Деплой в продакшен

**Цель:** развернуть приложение в продакшен-окружении через Docker Compose.

## Предварительные требования

- Docker и Docker Compose установлены на сервере
- Домен настроен и указывает на сервер
- SSL-сертификат (рекомендуется Let's Encrypt + Certbot)

---

## Переменные окружения (продакшен)

Создай `.env` на сервере. Никогда не коммить этот файл.

```env
# База данных
POSTGRES_USER=nexst
POSTGRES_PASSWORD=<сложный пароль>
POSTGRES_DB=nexst_prod
DATABASE_URL=postgresql://nexst:<пароль>@db:5432/nexst_prod

# JWT — генерировать: openssl rand -base64 64
JWT_SECRET=<минимум 64 символа>
JWT_REFRESH_SECRET=<другая строка, минимум 64 символа>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# NextAuth — генерировать: openssl rand -base64 64
NEXTAUTH_SECRET=<минимум 64 символа>
NEXTAUTH_URL=https://your-domain.com

# API
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

---

## Деплой

### 1. Скопировать код на сервер

```bash
git clone <url-репозитория> /opt/nexst
cd /opt/nexst
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
# Заполнить .env реальными значениями
```

### 3. Запустить

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Применить миграции

```bash
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma
```

### 5. Проверить

```bash
curl https://your-domain.com/health
# Ожидаемый ответ: {"status":"ok","timestamp":"..."}
```

---

## Обновление приложения

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
# Миграции, если были изменения схемы:
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate deploy
```

---

## Nginx

Конфиг: `docker/nginx.conf`

Nginx проксирует:
- `/api/*` → NestJS API на порту 3001
- `/health` → NestJS health check
- `/*` → Next.js Web на порту 3000

Для SSL добавь в `nginx.conf`:

```nginx
server {
  listen 443 ssl;
  server_name your-domain.com;

  ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  # ... остальной конфиг
}

server {
  listen 80;
  server_name your-domain.com;
  return 301 https://$host$request_uri;
}
```

---

## Чеклист перед деплоем

### Безопасность
- [ ] Все секреты (JWT_SECRET и т.д.) — случайные строки длиной 64+ символа
- [ ] Seed-пользователь (`admin@example.com`) удалён или пароль изменён
- [ ] `.env` не попал в git (проверить `git status`)
- [ ] Swagger (`/api/docs`) отключён или защищён в продакшене
- [ ] Rate limiting настроен (см. код `apps/api`)

### Инфраструктура
- [ ] SSL-сертификат получен и настроен
- [ ] Healthcheck для DB контейнера в compose работает
- [ ] Настроен мониторинг (uptime checks на `/health`)
- [ ] Настроены бэкапы базы данных

### Приложение
- [ ] `pnpm build` успешно выполняется
- [ ] `pnpm typecheck` без ошибок
- [ ] Переменные окружения валидируются при старте (zod в `apps/api/src/config/env.ts`)

---

## Частые проблемы

| Проблема | Причина | Решение |
|---|---|---|
| API не запускается | Ошибка валидации env | Проверить логи: `docker compose logs api` |
| 502 Bad Gateway | API или Web не поднялся | `docker compose ps`, проверить healthcheck |
| Ошибки Prisma при старте | Миграции не применены | Шаг 4 выше |
| CORS ошибки | `NEXTAUTH_URL` не совпадает с доменом | Проверить значение в `.env` |
