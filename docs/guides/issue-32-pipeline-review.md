# Ревью пайплайна парсинга и оценки релевантности (issue #32)

**Дата:** 2026-03-25
**Файлы:** `sync/`, `sources/`, `telegram/`, `scoring/`, `articles/`, `preferences/`

---

## Как устроен пайплайн

```
setInterval / POST /sync/trigger
        │
        ▼
  SyncService.syncAllSources()
        │  pLimit(5) — макс 5 источников параллельно
        ▼
  syncSource(source)
    ├─ fetchRss()     → rss-parser → mapRssFeedItems() → upsertMany()
    └─ fetchTelegram() → TelegramGate.getPosts() → upsertMany()
        │
        │  для каждого пользователя источника — pLimit(5)
        ▼
  scoreArticlesForUser(userId, sourceId, sourceType)
    │  getSettings(userId) — глобальные или per-source настройки
    │  findUnscoredBySource(userId, sourceId)
    │
    │  батчи по GROQ_BATCH_SIZE (по умолч. 10)
    ▼
  ScoringService.scoreBatch(articles, categories, interestsText)
    │  GroqGate.chat() → parse JSON ответа
    │  fallback: score=0.5 при ошибке
    ▼
  upsertUserArticle(userId, articleId, score)
  updateAiContent(articleId, sourceType, aiContent)
```

---

## Сводная таблица

| Приоритет      | #   | Проблема                                                              | Файл                         |
| -------------- | --- | --------------------------------------------------------------------- | ---------------------------- |
| 🔴 Критический | 1   | `isRunning` — не работает при нескольких инстансах                    | `sync.service.ts:35`         |
| 🔴 Критический | 2   | Если процесс упадёт — флаг `isRunning` зависнет навсегда              | `sync.service.ts:76`         |
| 🟠 Высокий     | 3   | N запросов `updateAiContent` вместо одного batch                      | `sources.service.ts:162`     |
| 🟠 Высокий     | 4   | Только один retry при rate limit Groq, нет exponential backoff        | `groq.gate.ts:47`            |
| 🟠 Высокий     | 5   | `findUnscoredBySource` — потенциально медленный LEFT JOIN без индекса | `articles.repository.ts:54`  |
| 🟠 Высокий     | 6   | per-source `relevanceThreshold` не применяется в фиде                 | `articles.repository.ts:105` |
| 🟡 Средний     | 7   | Нет circuit breaker — при недоступности Groq продолжаем слать запросы | `groq.gate.ts`               |
| 🟡 Средний     | 8   | Fallback к оценке 0.5 — статьи с любым контентом попадут в фид        | `scoring.service.ts:42`      |
| 🟡 Средний     | 9   | GUID-дубли: fallback к `title` не гарантирует уникальность            | `rss-mapper.ts:14`           |
| 🟡 Средний     | 10  | `setInterval` без cron — нет гарантии выполнения при перезапуске      | `sync.service.ts:44`         |
| 🟡 Средний     | 11  | Задержка между батчами фиксированная, не учитывает TPM-лимит Groq     | `scoring.service.ts:78`      |
| 🟢 Низкий      | 12  | Отфильтрованные статьи (без title/guid) не логируются                 | `articles.repository.ts:39`  |
| 🟢 Низкий      | 13  | Telegram-парсинг через HTML-скрейпинг — хрупко при изменении вёрстки  | `telegram.gate.ts`           |
| 🟢 Низкий      | 14  | Нет User-Agent у RSS-парсера                                          | `sync.service.ts:140`        |

---

## 🔴 Критические

### 1. `isRunning` не защищает при нескольких инстансах

**Файл:** `sync/sync.service.ts`, строки 30–35

```typescript
private isRunning = false; // Только для одного процесса
```

При горизонтальном масштабировании (2+ инстанса API) каждый имеет свой `isRunning = false` — все они одновременно запускают `syncAllSources()` каждые 30 минут. Это приводит к:

- многократному импорту одних статей
- параллельным вызовам Groq за одни и те же батчи
- конкуренции за строки в БД

**Решение — Redis distributed lock:**

```typescript
// sync.service.ts
private async acquireLock(ttlMs: number): Promise<boolean> {
  // SET sync:lock 1 PX <ttl> NX — атомарная операция
  const result = await this.redis.set('sync:global:lock', '1', 'PX', ttlMs, 'NX');
  return result === 'OK';
}

async syncAllSources(): Promise<void> {
  const acquired = await this.acquireLock(30 * 60 * 1000); // TTL = 1 цикл
  if (!acquired) {
    this.logger.log('Синхронизация уже запущена на другом инстансе');
    return;
  }
  try {
    // ... работа ...
  } finally {
    await this.redis.del('sync:global:lock');
  }
}
```

---

### 2. При краше процесса `isRunning` зависает навсегда

**Файл:** `sync/sync.service.ts`, строки 76–98

Если процесс упал между `this.isRunning = true` и `finally` (SIGKILL, OOM, unhandled rejection) — при следующем старте `isRunning` снова `false` (новый процесс), но **следующий запуск синхронизации может начаться без паузы**.

Более критичная ситуация: если какой-то `await` внутри синхронизации никогда не завершится (зависший fetch, deadlock в БД) — `isRunning` останется `true` до перезапуска процесса, и синхронизация больше не запустится.

**Решение — добавить timeout:**

```typescript
async syncAllSources(): Promise<void> {
  if (this.isRunning) { ... return; }
  this.isRunning = true;

  // Таймаут: принудительно снять флаг через 25 минут
  const timeout = setTimeout(() => {
    this.logger.error('Синхронизация превысила таймаут, сбрасываем флаг');
    this.isRunning = false;
  }, 25 * 60 * 1000);

  try {
    await this.doSync();
  } finally {
    clearTimeout(timeout);
    this.isRunning = false;
  }
}
```

При переходе на Redis lock проблема решается автоматически через TTL ключа.

---

## 🟠 Высокие

### 3. N запросов `updateAiContent` вместо одного batch

**Файл:** `sources/sources.service.ts`, строки 162–180

```typescript
// Текущий код — 10 отдельных UPDATE при batch_size=10
await Promise.all(
  batch.map(async (article, j) => {
    await this.articlesRepository.upsertUserArticle(...);
    if (result.aiContent) {
      await this.articlesRepository.updateAiContent(article.id, ...); // ← N запросов
    }
  }),
);
```

**Решение** — добавить в `ArticlesRepository` метод для batch-обновления:

```typescript
// articles.repository.ts
async updateAiContentBatch(
  updates: Array<{ articleId: string; sourceType: SourceType; aiContent: string }>,
): Promise<void> {
  // Разделяем по типу источника
  const summaryUpdates = updates.filter((u) => u.sourceType !== SourceType.TELEGRAM);
  const titleUpdates = updates.filter((u) => u.sourceType === SourceType.TELEGRAM);

  await this.prisma.$transaction([
    // Один UPDATE для RSS/ATOM summary
    ...(summaryUpdates.length > 0
      ? summaryUpdates.map((u) =>
          this.prisma.article.updateMany({
            where: { id: u.articleId, summary: null },
            data: { summary: u.aiContent },
          }),
        )
      : []),
    // Один UPDATE для Telegram aiTitle
    ...(titleUpdates.length > 0
      ? titleUpdates.map((u) =>
          this.prisma.article.updateMany({
            where: { id: u.articleId, aiTitle: null },
            data: { aiTitle: u.aiContent },
          }),
        )
      : []),
  ]);
}
```

Вызов в сервисе:

```typescript
const aiUpdates = batch
  .map((article, j) => ({ article, result: results[j]! }))
  .filter(({ result }) => result.aiContent != null)
  .map(({ article, result }) => ({
    articleId: article.id,
    sourceType,
    aiContent: result.aiContent!,
  }));

await Promise.all([
  ...batch.map((article, j) =>
    this.articlesRepository.upsertUserArticle(
      userId,
      article.id,
      results[j]!.score,
      results[j]!.reason,
    ),
  ),
  this.articlesRepository.updateAiContentBatch(aiUpdates),
]);
```

---

### 4. Только один retry при rate limit Groq

**Файл:** `scoring/groq.gate.ts`, строки 47–56

```typescript
// Текущий код — один retry, потом null
try {
  return await this.doRequest(messages, options);
} catch (retryErr) {
  this.logger.warn(`Groq повторная ошибка: ${String(retryErr)}`);
  return null; // Статьи получат fallback-оценку 0.5
}
```

**Решение — exponential backoff с несколькими попытками:**

```typescript
async chat(messages: GroqMessage[], options: GroqChatOptions = {}): Promise<string | null> {
  if (!this.client) return null;

  const MAX_RETRIES = 4;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await this.doRequest(messages, options);
    } catch (err) {
      if (!(err instanceof RateLimitError)) {
        this.logger.warn({ err }, 'Groq ошибка');
        return null; // Не rate-limit — не retry
      }

      if (attempt === MAX_RETRIES - 1) {
        this.logger.error('Groq rate limit: исчерпаны все попытки');
        return null;
      }

      // Берём Retry-After из заголовка или экспоненциальный backoff
      const retryMs = this.parseRetryAfterMs(err) ?? Math.min(1000 * 2 ** attempt, 30_000);
      this.logger.warn(`Groq rate limit (попытка ${attempt + 1}), ожидание ${retryMs}ms`);
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }

  return null;
}
```

---

### 5. `findUnscoredBySource` — медленный LEFT JOIN

**Файл:** `articles/articles.repository.ts`, строки 54–63

```typescript
where: {
  sourceId,
  userArticles: { none: { userId } },  // LEFT JOIN для каждой строки
},
```

Условие `none: { userId }` транслируется в `NOT EXISTS (SELECT 1 FROM user_articles WHERE ...)`. При росте таблицы `user_articles` запрос замедляется.

**Проверить план запроса** (`EXPLAIN ANALYZE`):

```sql
EXPLAIN ANALYZE
SELECT a.* FROM articles a
WHERE a.source_id = $1
  AND NOT EXISTS (
    SELECT 1 FROM user_articles ua
    WHERE ua.article_id = a.id AND ua.user_id = $2
  )
ORDER BY a.published_at DESC
LIMIT 50;
```

**Если индекс не используется, добавить в schema.prisma:**

```prisma
model UserArticle {
  // ...
  @@unique([userId, articleId])  // уже есть
  @@index([articleId, userId])   // добавить — для NOT EXISTS по articleId
}
```

Также ограничение `take: 50` стоит сделать конфигурируемым через константу.

---

### 6. per-source `relevanceThreshold` не применяется в фиде

**Файл:** `articles/articles.repository.ts`, строка 105

```typescript
// getFeed использует только глобальный threshold
const { threshold } = options; // ← откуда приходит?
// ...
score: { gte: threshold },
```

**Файл:** `feed/feed.service.ts`

```typescript
const settings = await this.preferencesRepository.getSettings(userId);
// settings.relevanceThreshold — глобальное значение
```

Если пользователь задал per-source порог 0.8 для конкретного канала, а глобальный 0.5 — в фид попадут статьи этого канала с оценкой 0.5+, игнорируя более строгую настройку.

**Решение** — применять per-source threshold при фильтрации:

Это сложная задача: `getFeed` возвращает статьи из **всех** источников одним запросом. Для per-source threshold нужно либо:

1. **Подход A (простой)** — при оценке статей `scoreArticlesForUser` использовать per-source threshold и **не сохранять** статьи ниже порога (текущая логика уже это делает частично). Минус: пересчёт при изменении порога невозможен.

2. **Подход B (гибкий, рекомендуется)** — хранить оценку, фильтровать при запросе. Для этого в `getFeed` нужно делать JOIN с `user_preferences` по `sourceId`:

```prisma
// В getFeed: вместо одного threshold
// применять per-source threshold через подзапрос
WHERE ua.score >= COALESCE(
  (SELECT (settings->>'relevanceThreshold')::float
   FROM user_preferences
   WHERE user_id = $userId AND source_id = a.source_id),
  $globalThreshold
)
```

Для Prisma это потребует raw query или вынесения фильтрации на уровень приложения.

---

## 🟡 Средние

### 7. Нет circuit breaker для Groq

**Файл:** `scoring/groq.gate.ts`

При длительной недоступности Groq система продолжает отправлять запросы с задержками, блокируя синхронизацию. Весь pipeline ждёт.

**Решение** — простой circuit breaker:

```typescript
@Injectable()
export class GroqGate {
  private failureCount = 0;
  private circuitOpenUntil = 0;
  private readonly FAILURE_THRESHOLD = 3;
  private readonly OPEN_DURATION_MS = 60_000; // 1 минута

  async chat(messages: GroqMessage[], options: GroqChatOptions = {}): Promise<string | null> {
    if (!this.client) return null;

    // Circuit OPEN — не пробуем
    if (Date.now() < this.circuitOpenUntil) {
      this.logger.warn('Groq circuit open, пропускаем запрос');
      return null;
    }

    try {
      const result = await this.doRequestWithRetry(messages, options);
      this.failureCount = 0; // Сброс при успехе
      return result;
    } catch {
      this.failureCount++;
      if (this.failureCount >= this.FAILURE_THRESHOLD) {
        this.circuitOpenUntil = Date.now() + this.OPEN_DURATION_MS;
        this.logger.error(`Groq circuit открыт на ${this.OPEN_DURATION_MS / 1000}с`);
      }
      return null;
    }
  }
}
```

---

### 8. Fallback к оценке 0.5 маскирует проблемы

**Файл:** `scoring/scoring.service.ts`, строки 42–43

```typescript
// При ошибке все статьи получают нейтральную оценку
return articles.map(() => ({ score: 0.5, reason: 'neutral', aiContent: null }));
```

При порогах 0.5 и ниже пользователь увидит **все** статьи без фильтрации и не поймёт, что AI не работает.

**Решение** — явно маркировать неоценённые статьи:

```typescript
// Вариант 1: специальное значение для «не оценено»
return articles.map(() => ({ score: -1, reason: 'ai_unavailable', aiContent: null }));
// И в getFeed фильтровать score = -1 как "показать с предупреждением"

// Вариант 2: не создавать UserArticle при недоступности AI
// Статьи просто не попадут в фид до следующей успешной оценки
// → пропустить scoreArticlesForUser и залогировать
```

Вариант 2 безопаснее: пользователь не видит нефильтрованный поток, а видит пустой фид с понятным объяснением.

---

### 9. GUID-дубли: fallback к `title` ненадёжен

**Файл:** `sources/rss-mapper.ts`, строки 14–15

```typescript
guid: item.guid ?? item.link ?? item.title ?? '',
```

Если источник не предоставляет `guid` и `link`, а `title` не уникален (например, «Без названия», «[без темы]») — два разных поста получат одинаковый `guid`. Первый импортируется, второй молча пропускается благодаря `skipDuplicates: true`.

**Решение:**

```typescript
// Генерировать детерминированный GUID из контента
import { createHash } from 'crypto';

function makeGuid(item: RssItem): string {
  if (item.guid) return item.guid;
  if (item.link) return item.link;

  // Детерминированный хэш из title + publishedAt
  const source = `${item.title ?? ''}::${item.pubDate ?? item.isoDate ?? ''}`;
  return `hash:${createHash('sha1').update(source).digest('hex').slice(0, 16)}`;
}
```

---

### 10. `setInterval` без cron — нет гарантии выполнения

**Файл:** `sync/sync.service.ts`, строки 44–48

```typescript
setInterval(() => void this.syncAllSources(), intervalMs);
```

Проблемы:

- При перезапуске процесса синхронизация не запускается сразу — ждёт следующего интервала (до 30 минут)
- Нет записи о том, когда последний раз успешно завершилась синхронизация
- При длительной синхронизации (> interval) следующий запуск начнётся не дождавшись завершения предыдущего

**Решение для текущего масштаба** — `@nestjs/schedule`:

```typescript
// sync.module.ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
})

// sync.service.ts
@Cron(CronExpression.EVERY_30_MINUTES)
async syncAllSources(): Promise<void> { ... }
```

**Решение для масштабирования** — вынести синхронизацию в отдельный worker-сервис (BullMQ + Redis).

---

### 11. Задержка между батчами не учитывает TPM-лимит Groq

**Файл:** `scoring/scoring.service.ts`, строки 77–78

```typescript
const maxTokens = 150 * articles.length; // При 10 статьях = 1500 токенов
```

При `GROQ_BATCH_SIZE=10` и `GROQ_BATCH_DELAY_MS=2000`:

- RPM = 60_000 / 2000 = **30 запросов/мин** (укладывается в лимит)
- TPM = 1500 × 30 = **45 000 токенов/мин** (превышает лимит бесплатного ключа ~6K–8K TPM)

Это означает, что 429 будет приходить не из-за RPM, а из-за TPM — и текущая задержка 2 секунды не поможет.

**Решение:**

```typescript
// env.ts — добавить переменную
GROQ_TPM_LIMIT: z.coerce.number().default(6000),

// scoring.service.ts — динамическая задержка с учётом токенов
const tokensUsed = maxTokens; // Реально потреблено из ответа
const minDelayForTpm = (tokensUsed / env.GROQ_TPM_LIMIT) * 60_000;
const delay = Math.max(GROQ_BATCH_DELAY_MS, minDelayForTpm);
```

Также стоит логировать реальное потребление токенов из `completion.usage` в `groq.gate.ts`.

---

## 🟢 Низкие

### 12. Отфильтрованные статьи не логируются

**Файл:** `articles/articles.repository.ts`, строки 39–44

```typescript
const data = articles.filter((a) => a.title && a.guid).map(...);
if (data.length === 0) return;
```

Если источник отдаёт 20 статей, а 5 из них без GUID — пользователь и разработчик не узнают.

**Решение:**

```typescript
const valid = articles.filter((a) => a.title && a.guid);
const skipped = articles.length - valid.length;

if (skipped > 0) {
  this.logger.warn({ sourceId, skipped }, 'Пропущены статьи без title или guid');
}
if (valid.length === 0) return;
```

---

### 13. Telegram-парсинг через HTML — хрупко при изменении вёрстки

**Файл:** `telegram/telegram.gate.ts`

Парсинг через cheerio (`$('.tgme_widget_message[data-post]')`) зависит от CSS-классов публичного виджета Telegram. Telegram может изменить вёрстку без предупреждения.

**Смягчение:**

```typescript
// Добавить явную проверку: если посты не найдены — warn, не error
const posts: TelegramPost[] = [];
// ... парсинг ...

if (posts.length === 0 && $('body').length > 0) {
  // Страница загрузилась, но постов нет — возможно изменилась вёрстка
  this.logger.warn(
    { channelUrl: url },
    'Telegram: посты не найдены, возможно изменилась структура виджета',
  );
}
```

Долгосрочно — рассмотреть официальный Bot API (если каналы публичные).

---

### 14. Нет User-Agent у RSS-парсера

**Файл:** `sync/sync.service.ts`, строка 140

```typescript
const parser = new Parser({ timeout: 10000 });
// User-Agent по умолчанию: rss-parser/...
```

Некоторые сайты блокируют запросы без явного User-Agent или с ботовым.

**Решение:**

```typescript
const parser = new Parser({
  timeout: 10_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CurioBot/1.0; +https://curio.app)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
  },
});
```

---

## Рекомендации по масштабированию

При росте до **100+ источников** и **1000+ пользователей** текущая архитектура упрётся в следующие ограничения:

### Горизонтальное масштабирование API

| Сейчас                       | При масштабировании                            |
| ---------------------------- | ---------------------------------------------- |
| `isRunning` в памяти         | Redis distributed lock (SETNX + TTL)           |
| `setInterval` в API-процессе | Отдельный worker-сервис или BullMQ             |
| Синхронный pipeline          | Очередь задач: каждый источник — отдельная job |

### Очередь на BullMQ (рекомендуется при > 50 источников)

```
SyncScheduler (cron)
      │
      │  addJob(sourceId) — 1 job на источник
      ▼
  Bull Queue: "sync"
      │  N воркеров параллельно
      ▼
  SyncWorker.process(sourceId)
      │
      │  addJob(userId, sourceId, sourceType)
      ▼
  Bull Queue: "scoring"
      │  M воркеров параллельно
      ▼
  ScoringWorker.process(userId, sourceId, sourceType)
```

Преимущества:

- Retry и dead-letter queue из коробки
- Мониторинг через Bull Dashboard
- Горизонтальное масштабирование воркеров независимо от API
- Нет потери задач при перезапуске

### Groq: управление квотой

При 1000 пользователей × 50 источников × 50 статей = **2 500 000 статей** для оценки после старта — это невозможно с одним Groq-ключом.

**Стратегия:**

1. **Приоритизация**: сначала оценивать статьи активных пользователей
2. **Дедупликация оценок**: если одну статью читают 100 пользователей — оценить один раз, переиспользовать
3. **Кэш оценок**: добавить `globalScore` на уровне `Article` для «базовой» оценки без учёта персональных настроек
4. **Несколько ключей**: ротация API-ключей при hit rate limit

---

## Баги, требующие немедленного исправления

### Баг 1: `updateAiContent` вызывается без обработки ошибок

**Файл:** `sources/sources.service.ts`, строки 162–180

```typescript
// Если updateAiContent бросит ошибку — она проглотится в Promise.all
await Promise.all(
  batch.map(async (article, j) => {
    await this.articlesRepository.upsertUserArticle(...);
    if (result.aiContent) {
      await this.articlesRepository.updateAiContent(...); // ← нет try-catch
    }
  }),
);
```

**Исправление:**

```typescript
await Promise.allSettled(
  batch.map(async (article, j) => {
    try {
      await this.articlesRepository.upsertUserArticle(...);
      if (result.aiContent) {
        await this.articlesRepository.updateAiContent(...);
      }
    } catch (err) {
      this.logger.error({ err, articleId: article.id }, 'Ошибка сохранения оценки');
    }
  }),
);
```

---

### Баг 2: Ошибка в `sync.service.ts` при парсинге Telegram — пишет в `lastError` строку `Error`, а не сообщение

**Файл:** `sync/sync.service.ts`, строки 155–165 (примерная область)

```typescript
} catch (err) {
  await this.sourcesRepository.setLastError(source.id, String(err));
}
```

`String(new Error('message'))` возвращает `"Error: message"` — это нормально. Но если `err` не `Error` (например, строка от внешнего API) — информация может потеряться.

**Исправление:**

```typescript
const message = err instanceof Error ? err.message : String(err);
await this.sourcesRepository.setLastError(source.id, message);
```

---

### Баг 3: Задержка не добавляется перед **первым** батчем при параллельной оценке нескольких пользователей

**Файл:** `sources/sources.service.ts`

Если у источника 5 подписчиков и для каждого запускается `scoreArticlesForUser` параллельно (через `pLimit(5)`) — 5 батчей одновременно улетят в Groq без задержки между ними, мгновенно исчерпав RPM-квоту.

**Исправление** — добавить jitter перед первым батчем:

```typescript
// sources.service.ts: scoreArticlesForUser
// Случайная задержка 0–2с перед стартом, чтобы размазать пики
const jitterMs = Math.floor(Math.random() * 2000);
await new Promise((r) => setTimeout(r, jitterMs));

for (let i = 0; i < articles.length; i += GROQ_BATCH_SIZE) {
  // ...
}
```
