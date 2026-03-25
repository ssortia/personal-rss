# Рекомендации по рефакторингу — Curio MVP (issue #32)

**Дата:** 2026-03-25

Документ охватывает весь проект: `apps/api`, `apps/web`, `packages/types`. Проблемы упорядочены по приоритету.

---

## Сводная таблица

| Приоритет      | #   | Проблема                                                    | Файл(ы)                                                        |
| -------------- | --- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| 🔴 Критический | 1   | Rate-limiting отсутствует                                   | `main.ts`                                                      |
| 🔴 Критический | 2   | Ошибки в fire-and-forget без catch                          | `sources.service.ts`                                           |
| 🟠 Высокий     | 3   | Дублирование типов DTO (backend vs packages/types)          | `auth/dto/`, `types/auth.ts`                                   |
| 🟠 Высокий     | 4   | Нормализация Telegram username в трёх местах                | `sources.service.ts`, `sync.service.ts`, `add-source-form.tsx` |
| 🟠 Высокий     | 5   | SourcesService нарушает SRP                                 | `sources.service.ts`                                           |
| 🟠 Высокий     | 6   | ScoringService жёстко зависит от GroqGate (нарушение DIP)   | `scoring.service.ts`                                           |
| 🟡 Средний     | 7   | Магические числа и строки по всему проекту                  | Множество                                                      |
| 🟡 Средний     | 8   | Парсинг JSON из preferences вручную вместо Zod              | `preferences.repository.ts`                                    |
| 🟡 Средний     | 9   | Небезопасный каст `undefined as T` при 204                  | `apps/web/src/lib/api.ts`                                      |
| 🟡 Средний     | 10  | Non-null assert `session!.accessToken!` без проверки        | `hooks/use-feed.ts`                                            |
| 🟡 Средний     | 11  | `SourceType` дублируется как строковый union в ArticleInput | `scoring.service.ts`                                           |
| 🟢 Низкий      | 12  | `as any` в конфигурации pino-http                           | `app.module.ts`                                                |
| 🟢 Низкий      | 13  | Глобальный isRunning не работает при масштабировании        | `sync.service.ts`                                              |
| 🟢 Низкий      | 14  | Название приложения «Curio» захардкожено в 4+ местах        | Множество                                                      |
| 🟢 Низкий      | 15  | Отсутствие комментариев в cursor-based пагинации            | `articles.repository.ts`                                       |

---

## 🔴 Критические

### 1. Отсутствие rate-limiting

**Файл:** `apps/api/src/main.ts`

Нет защиты от brute-force на `/auth/login`, `/auth/forgot-password` и перебора токенов. Любой может отправить неограниченное число запросов.

**Решение:**

```bash
pnpm --filter @repo/api add @nestjs/throttler
```

```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})

// На auth-эндпоинтах ужесточить:
// auth.controller.ts
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Post('login')
login() { ... }
```

---

### 2. Ошибки в fire-and-forget без catch

**Файл:** `apps/api/src/sources/sources.service.ts`, строки 67–70

```typescript
// Текущий код — ошибка в scoreArticlesForUser бесследно проглатывается
void Promise.all([...]).then(() => this.scoreArticlesForUser(...));
```

**Решение:**

```typescript
void Promise.all([
  this.articlesRepository.upsertMany(source.id, articles),
  this.sourcesRepository.updateLastFetchAt(source.id),
])
  .then(() => this.scoreArticlesForUser(userId, source.id, SourceType.RSS))
  .catch((err: unknown) =>
    this.logger.error({ err, sourceUrl: source.url }, 'Ошибка первичного импорта'),
  );
```

Аналогично проверить `sync.service.ts` — там логирование есть, но убедиться что все Promise-цепочки имеют catch.

---

## 🟠 Высокие

### 3. Дублирование типов DTO между backend и packages/types

**Файлы:** `apps/api/src/auth/dto/login.dto.ts` и `packages/types/src/auth.ts`

`LoginDto` определён дважды: через `class-validator` для NestJS и через Zod для фронтенда. При изменении одного второй легко забыть обновить.

**Решение — сгенерировать class-validator DTO из Zod-схем** через `nestjs-zod`:

```bash
pnpm --filter @repo/api add nestjs-zod
```

```typescript
// packages/types/src/auth.ts — один источник истины
export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// apps/api/src/auth/dto/login.dto.ts
import { createZodDto } from 'nestjs-zod';
import { LoginDtoSchema } from '@repo/types';

export class LoginDto extends createZodDto(LoginDtoSchema) {}
```

В `main.ts` заменить `ValidationPipe` на `ZodValidationPipe` из `nestjs-zod`. Это автоматически синхронизирует все DTO.

---

### 4. Нормализация Telegram username в трёх местах

**Файлы:**

- `apps/api/src/sources/sources.service.ts` — нормализация при добавлении источника
- `apps/api/src/sync/sync.service.ts` — парсинг URL при синхронизации
- `apps/web/src/components/sources/add-source-form.tsx` — определение типа во фронтенде

Три разные реализации, которые могут разойтись.

**Решение** — утилиты в `packages/types/src/telegram.ts`:

```typescript
/** Приводит любой формат к username: @channel → channel, t.me/channel → channel */
export function normalizeTelegramUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/^@/, '');
}

/** Определяет, является ли строка ссылкой на Telegram */
export function isTelegramInput(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith('@') ||
    v.startsWith('t.me/') ||
    v.startsWith('https://t.me/') ||
    v.startsWith('http://t.me/')
  );
}
```

Использовать везде из `@repo/types`.

---

### 5. SourcesService нарушает принцип единственной ответственности

**Файл:** `apps/api/src/sources/sources.service.ts`

Сервис одновременно отвечает за: добавление RSS-источников, добавление Telegram-каналов, управление подписками (toggle, remove) и AI-оценку статей. Это делает его сложно тестируемым и трудно изменяемым.

**Решение** — выделить оценку статей в отдельный класс:

```typescript
// apps/api/src/scoring/articles-scoring.service.ts
@Injectable()
export class ArticlesScoringService {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly articlesRepository: ArticlesRepository,
    private readonly preferencesRepository: PreferencesRepository,
  ) {}

  async scoreForUser(userId: string, sourceId: string, sourceType: SourceType): Promise<void> {
    // Логика перенесена из sources.service.ts и sync.service.ts
  }
}
```

`SourcesService` инжектирует `ArticlesScoringService` и делегирует ему оценку. `SyncService` тоже использует `ArticlesScoringService` напрямую.

---

### 6. ScoringService жёстко зависит от GroqGate

**Файл:** `apps/api/src/scoring/scoring.service.ts`

При необходимости сменить AI-провайдер (Claude, OpenAI) нужно менять `ScoringService` — это нарушение DIP.

**Решение** — интерфейс провайдера:

```typescript
// apps/api/src/scoring/ai-gateway.interface.ts
export const AI_GATEWAY = Symbol('AI_GATEWAY');

export interface AiGateway {
  readonly isAvailable: boolean;
  chat(messages: AiMessage[]): Promise<string | null>;
}

// scoring.module.ts
{
  provide: AI_GATEWAY,
  useExisting: GroqGate,  // Легко заменить на другой класс
}

// scoring.service.ts
constructor(@Inject(AI_GATEWAY) private readonly aiGateway: AiGateway) {}
```

---

## 🟡 Средние

### 7. Магические числа и строки

Захардкоженные значения разбросаны по коду:

| Файл                     | Строка | Значение         | Смысл                            |
| ------------------------ | ------ | ---------------- | -------------------------------- |
| `articles.repository.ts` | 61, 66 | `50`             | Лимит статей по умолчанию        |
| `scoring.service.ts`     | 51     | `500`            | Длина превью контента для AI     |
| `scoring.service.ts`     | 78     | `150`            | Токенов на статью для Groq       |
| `article-card.tsx`       | 48     | `300`            | Длина превью Telegram-поста      |
| `auth.service.ts`        | 81     | `60 * 60 * 1000` | TTL токена сброса пароля (1 час) |

**Решение** — файл констант:

```typescript
// apps/api/src/config/constants.ts
export const FEED_DEFAULT_LIMIT = 50;
export const SCORING_CONTENT_PREVIEW_LENGTH = 500;
export const SCORING_TOKENS_PER_ARTICLE = 150;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 час

// apps/web/src/config/constants.ts
export const TELEGRAM_POST_PREVIEW_LENGTH = 300;
```

---

### 8. Ручной парсинг JSON в preferences.repository вместо Zod

**Файл:** `apps/api/src/preferences/preferences.repository.ts`, строки 100–111

```typescript
// Текущий код — 20 строк ручных проверок типов
if (typeof s['relevanceThreshold'] === 'number') {
  result.relevanceThreshold = s['relevanceThreshold'];
}
// ... и так для каждого поля
```

**Решение** — `PreferencesSettingsSchema` уже определена в `packages/types`:

```typescript
import { PreferencesSettingsSchema } from '@repo/types';

private parseSettings(raw: unknown): Partial<PreferencesSettings> {
  const result = PreferencesSettingsSchema.partial().safeParse(raw);
  return result.success ? result.data : {};
}
```

---

### 9. Небезопасный каст `undefined as T` при HTTP 204

**Файл:** `apps/web/src/lib/api.ts`, строки 53–54

```typescript
if (res.status === 204) {
  return undefined as T; // T может быть объектом — каст заглушает ошибку TS
}
```

**Решение** — явный тип для операций без тела ответа:

```typescript
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> { ... }
export async function apiFetchVoid(path: string, options: RequestOptions = {}): Promise<void> { ... }
```

Использовать `apiFetchVoid` для DELETE и аналогичных операций.

---

### 10. Non-null assert без проверки в use-feed

**Файл:** `apps/web/src/hooks/use-feed.ts`

```typescript
articlesApi.getFeed({ ... }, session!.accessToken!)
// Если токен отсутствует — TypeError в рантайме, а не понятная ошибка
```

**Решение:**

```typescript
queryFn: ({ pageParam }) => {
  if (!session?.accessToken) throw new Error('Access token is missing');
  return articlesApi.getFeed({ cursor: pageParam as string | undefined, limit: LIMIT }, session.accessToken);
},
```

---

### 11. Дублирование SourceType как строкового union

**Файл:** `apps/api/src/scoring/scoring.service.ts`, строки 5–9

```typescript
interface ArticleInput {
  sourceType: 'RSS' | 'ATOM' | 'TELEGRAM'; // Копия SourceType из Prisma
}
```

**Решение:**

```typescript
import { SourceType } from '@prisma/client';

interface ArticleInput {
  sourceType: SourceType;
}
```

---

## 🟢 Низкие

### 12. `as any` в конфиге pino-http

**Файл:** `apps/api/src/app.module.ts`, строка 26

**Решение:**

```typescript
import type { Options } from 'pino-http';

const pinoHttpConfig: Options = {
  customSuccessfulResponseLogLevel: 'silent',
  transport: process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty' } : undefined,
};
```

---

### 13. `isRunning` не работает при горизонтальном масштабировании

**Файл:** `apps/api/src/sync/sync.service.ts`, строка 35

Флаг `private isRunning = false` — локальная переменная процесса. При нескольких репликах API синхронизация будет запускаться параллельно.

**Решение (когда потребуется масштабирование):**

```typescript
// Использовать Redis-based distributed lock
private async acquireSyncLock(): Promise<boolean> {
  return this.redis.set('sync:global:lock', '1', 'PX', 5 * 60 * 1000, 'NX');
}
```

Сейчас можно оставить с комментарием о ограничении.

---

### 14. Название приложения захардкожено в 4+ местах

**Файлы:** `feed.service.ts`, `app.module.ts`, `(auth)/layout.tsx`, `(dashboard)/layout.tsx`

**Решение:**

```typescript
// packages/types/src/app-config.ts или отдельный конфиг пакет
export const APP_NAME = 'Curio';
export const APP_DESCRIPTION = 'Персональная читалка новостей';
```

---

### 15. Отсутствие комментариев в cursor-based пагинации

**Файл:** `apps/api/src/articles/articles.repository.ts`, строки 86–120

Сложная логика с `OR` условиями и tie-breaker по ID не имеет объяснения. При изменении разработчик без контекста не поймёт, почему именно такой запрос.

**Решение** — добавить JSDoc:

```typescript
/**
 * WHERE-условие для cursor-based пагинации по (publishedAt DESC, id DESC).
 *
 * Алгоритм:
 * 1. Статьи с publishedAt < cursor.publishedAt (строго старше)
 * 2. Статьи с той же датой, но id < cursor.id (tie-breaker)
 * 3. Статьи без publishedAt идут после всех датированных
 *
 * Такой подход даёт стабильный порядок при одинаковых датах.
 */
const cursorWhere: Prisma.ArticleWhereInput = cursor ? { ... } : {};
```

---

## Порядок выполнения

Рекомендуемая последовательность, если делать поэтапно:

1. **Сразу** (безопасность): rate-limiting (#1), catch в fire-and-forget (#2)
2. **Следующий спринт** (архитектура): нормализация Telegram (#4), ArticlesScoringService (#5), AI-интерфейс (#6)
3. **Технический долг** (качество кода): константы (#7), Zod в preferences (#8), non-null asserts (#9, #10), SourceType (#11)
4. **По возможности** (polish): остальные низкоприоритетные пункты
