# Архитектурное ревью фронтенда — Curio MVP (issue #32)

**Дата:** 2026-03-25
**Область:** `apps/web/src/`

---

## Общая оценка

Фронтенд построен грамотно: чёткое разделение API-слоя и UI, консистентное использование React Query, типы из `@repo/types`. Проблемы сосредоточены в двух зонах — **отсутствие error boundaries** и **дублирование небольших утилит** между компонентами.

---

## Сводная таблица

| Приоритет  | #   | Проблема                                           | Файл(ы)                                                               |
| ---------- | --- | -------------------------------------------------- | --------------------------------------------------------------------- |
| 🔴 Высокий | 1   | Нет error boundaries и error.tsx                   | —                                                                     |
| 🔴 Высокий | 2   | Дублирование error-handler логики в формах         | `register-form.tsx`, `reset-password-form.tsx`, `add-source-form.tsx` |
| 🟠 Средний | 3   | Неоптимальная конфигурация QueryClient             | `providers.tsx`                                                       |
| 🟠 Средний | 4   | `useDebounce` определён дважды по-разному          | `interests-text-input.tsx`, `users-table.tsx`                         |
| 🟠 Средний | 5   | Форматирование дат дублируется в трёх местах       | `article-card.tsx`, `source-card.tsx`, `users-table.tsx`              |
| 🟠 Средний | 6   | Tailwind-цвета для бейджей дублируются             | `add-source-form.tsx`, `article-card.tsx`                             |
| 🟠 Средний | 7   | Дублирование guard-логики в layouts                | `(dashboard)/layout.tsx`, `admin/layout.tsx`                          |
| 🟢 Низкий  | 8   | Type cast вместо module augmentation в session     | `auth.ts`                                                             |
| 🟢 Низкий  | 9   | Хрупкая инициализация localValue в ThresholdSlider | `threshold-slider.tsx`                                                |
| 🟢 Низкий  | 10  | Нет client-side валидации URL перед отправкой      | `add-source-form.tsx`                                                 |
| 🟢 Низкий  | 11  | Logout отсутствует в мобильном меню                | `mobile-menu.tsx`                                                     |

---

## 🔴 Высокий приоритет

### 1. Нет error boundaries и error.tsx

Обработка ошибок запросов сделана вручную через `isError` флаг React Query на каждой странице. При этом нет перехвата JavaScript-исключений: если компонент бросит ошибку вне запроса — пользователь увидит белый экран.

Файлы с ручной обработкой (каждый дублирует один и тот же паттерн):

- `(dashboard)/page.tsx`, строки 45–50
- `(dashboard)/sources/page.tsx`, строки 68–74
- `admin/users/users-table.tsx` — своя обработка

**Решение** — добавить `error.tsx` на уровне route groups:

```
apps/web/src/app/error.tsx               ← глобальный fallback
apps/web/src/app/(dashboard)/error.tsx
apps/web/src/app/(auth)/error.tsx
apps/web/src/app/admin/error.tsx
```

```tsx
// app/(dashboard)/error.tsx
'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-muted-foreground text-sm">Что-то пошло не так</p>
      <button onClick={reset} className="text-primary text-sm hover:underline">
        Попробовать снова
      </button>
    </div>
  );
}
```

---

### 2. Дублирование error-handler логики в формах

В каждой форме одинаковый `catch`-блок с ручной проверкой `ApiError.status`:

```typescript
// register-form.tsx
} catch (err) {
  if (err instanceof ApiError && err.status === 409) {
    setServerError('Пользователь с таким email уже существует');
  } else {
    setServerError('Произошла ошибка. Попробуйте ещё раз.');
  }
}

// reset-password-form.tsx — аналогично, другой текст
// add-source-form.tsx — аналогично
```

**Решение** — файл `src/lib/form-errors.ts`:

```typescript
import { ApiError } from './api';

/** Возвращает читаемое сообщение об ошибке для форм аутентификации. */
export function getAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Пользователь с таким email уже существует';
    if (error.status === 401) return 'Неверный email или пароль';
    if (error.status === 400) return 'Проверьте введённые данные';
  }
  return 'Произошла ошибка. Попробуйте ещё раз.';
}

export function getSourceError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Источник уже добавлен';
    if (error.status === 400) return 'Неверный URL или канал не найден';
  }
  return 'Произошла ошибка. Попробуйте ещё раз.';
}
```

Функция `getAddSourceError` уже частично существует в `use-sources.ts` — перенести туда же и унифицировать.

---

## 🟠 Средний приоритет

### 3. Неоптимальная конфигурация QueryClient

**Файл:** `src/components/providers.tsx`

Текущий конфиг минимален:

```typescript
const [queryClient] = useState(
  () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }),
);
```

Не настроены:

- `gcTime` — кэш хранится бесконечно между навигациями
- `retry` — при 401 (истёкший токен) будет три попытки вместо немедленного редиректа
- `refetchOnWindowFocus` — каждый раз при переключении вкладки идут запросы

**Решение** — вынести конфиг в `src/lib/query-client.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Не повторять при ошибках авторизации
          if (error instanceof ApiError && error.status === 401) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
```

---

### 4. `useDebounce` определён дважды по-разному

**Файл 1:** `src/components/preferences/interests-text-input.tsx`, строки 9–16

```typescript
// Локальный хук внутри файла компонента
function useDebounce<T>(value: T, delay: number): T { ... }
```

**Файл 2:** `src/app/admin/users/users-table.tsx`, строки 48–51

```typescript
// Другая реализация через useEffect + setState напрямую
useEffect(() => {
  const id = setTimeout(() => setDebouncedEmail(emailInput), 400);
  return () => clearTimeout(id);
}, [emailInput]);
```

**Решение** — `src/hooks/use-debounce.ts`:

```typescript
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

---

### 5. Форматирование дат дублируется в трёх местах

| Файл                             | Функция          | Формат                                   |
| -------------------------------- | ---------------- | ---------------------------------------- |
| `article-card.tsx`, строки 12–20 | `formatDate`     | `day numeric, month short, hour, minute` |
| `source-card.tsx`, строки 33–43  | `formatSyncTime` | относительное время («2 ч. назад»)       |
| `admin/users/users-table.tsx`    | inline           | `dd.mm.yyyy`                             |

Разные форматы для разного контекста — это нормально, но функции дублируются вместо переиспользования.

**Решение** — `src/lib/date.ts`:

```typescript
/** Форматирует дату для карточки статьи: «25 мар, 14:30». */
export function formatArticleDate(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Возвращает относительное время: «5 мин. назад», «2 ч. назад». */
export function formatRelativeTime(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  return `${days} дн. назад`;
}

/** Форматирует дату в короткий вид: «25.03.2026». */
export function formatShortDate(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ru-RU');
}
```

---

### 6. Tailwind-классы для цветных бейджей дублируются

**Файл 1:** `add-source-form.tsx`, строки 29–32 — цвета для RSS/Telegram типа источника

```typescript
const TYPE_COLORS: Record<SourceType, string> = {
  rss: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  telegram: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};
```

**Файл 2:** `article-card.tsx`, строки 25–30 — цвета для score-бейджей (те же паттерны)

```typescript
score >= 0.7
  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
```

**Решение** — `src/lib/badge-colors.ts`:

```typescript
export const BADGE_COLORS = {
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
} as const;

export const SOURCE_TYPE_COLORS: Record<string, string> = {
  rss: BADGE_COLORS.orange,
  telegram: BADGE_COLORS.blue,
};

export function getScoreColor(score: number): string {
  if (score >= 0.7) return BADGE_COLORS.green;
  if (score >= 0.4) return BADGE_COLORS.yellow;
  return 'bg-muted text-muted-foreground';
}
```

---

### 7. Дублирование auth-guard логики в layouts

**Файл 1:** `(dashboard)/layout.tsx`, строки 11–16

```typescript
const session = await auth();
if (!session || session.error === 'RefreshAccessTokenError') {
  redirect('/login');
}
```

**Файл 2:** `admin/layout.tsx`, строки 12–17 — идентичный код

**Решение** — `src/lib/auth-guard.ts`:

```typescript
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import type { Session } from 'next-auth';

/** Проверяет авторизацию и возвращает session. При ошибке редиректит на /login. */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session || session.error === 'RefreshAccessTokenError') {
    redirect('/login');
  }
  return session;
}

/** Дополнительно проверяет роль администратора. */
export async function requireAdminSession(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }
  return session;
}
```

---

## 🟢 Низкий приоритет

### 8. Type cast вместо module augmentation в session callback

**Файл:** `src/auth.ts`, строка ~88

```typescript
// Текущий код
(session as { accessToken?: string }).accessToken = token['accessToken'] as string;
```

Тип `accessToken` уже расширен в `src/types/next-auth.d.ts`, поэтому каст лишний.

**Решение:**

```typescript
session.accessToken = token['accessToken'] as string;
```

---

### 9. Хрупкая инициализация localValue в ThresholdSlider

**Файл:** `src/components/preferences/threshold-slider.tsx`, строки 14–19

```typescript
useEffect(() => {
  if (settings?.relevanceThreshold !== undefined && localValue === null) {
    setLocalValue(settings.relevanceThreshold);
  }
}, [settings?.relevanceThreshold, localValue]);
```

Условие `localValue === null` означает, что если пользователь сбросит настройки (значение вернётся с сервера), ползунок не обновится.

**Решение:**

```typescript
// Инициализировать только при первой загрузке данных
const initialized = useRef(false);

useEffect(() => {
  if (!initialized.current && settings?.relevanceThreshold !== undefined) {
    setLocalValue(settings.relevanceThreshold);
    initialized.current = true;
  }
}, [settings?.relevanceThreshold]);
```

Или проще — убрать localValue и использовать `defaultValue` у input:

```typescript
// Ключ сбрасывает компонент при изменении настроек
<input key={settings?.relevanceThreshold} defaultValue={settings?.relevanceThreshold ?? 0.5} ... />
```

---

### 10. Нет client-side валидации URL перед отправкой

**Файл:** `src/components/sources/add-source-form.tsx`

Кнопка «Добавить» активна при любом непустом вводе. Ошибка «неверный URL» приходит только после запроса к серверу.

**Решение** — минимальная проверка для мгновенной обратной связи:

```typescript
function getInputError(value: string, type: SourceType): string | null {
  if (type === 'rss') {
    try {
      new URL(value);
    } catch {
      return 'Введите корректный URL';
    }
  }
  if (type === 'telegram') {
    const handle = value.replace(/^(https?:\/\/)?t\.me\//, '').replace(/^@/, '');
    if (!/^[a-zA-Z0-9_]{5,}$/.test(handle)) return 'Неверный формат канала';
  }
  return null;
}
```

---

### 11. Logout отсутствует в мобильном меню

**Файл:** `src/components/layout/mobile-menu.tsx`

Кнопка выхода есть только в desktop-версии layout. На мобильных устройствах пользователь не может выйти из аккаунта без изменения URL.

**Решение** — добавить `SignOutButton` в `MobileMenu` (или вынести кнопку выхода в отдельный компонент и использовать в обоих местах).

---

## Что сделано хорошо

- **Разделение слоёв** — API (`src/lib/api.ts` + `src/api/`), хуки, компоненты разделены чётко
- **Типизация** — нет `any`, типы из `@repo/types`, Zod в формах авторизации
- **React Query** — правильный паттерн: хуки инкапсулируют мутации и запросы, компоненты только рендерят
- **Безопасность** — нет `dangerouslySetInnerHTML`, localStorage не используется для токенов
- **Server/Client граница** — layouts серверные, страницы клиентские только там где нужно
- **Skeleton-состояния** — есть на всех ключевых страницах

---

## Порядок выполнения

1. **Сразу** — error.tsx файлы (#1) и `form-errors.ts` (#2): защищают пользователя от белого экрана
2. **Следующий спринт** — `createQueryClient` (#3), `auth-guard.ts` (#7): снижают технический долг
3. **По возможности** — утилиты `use-debounce`, `date.ts`, `badge-colors.ts` (#4–6): убирают дублирование
4. **При рефакторинге конкретного компонента** — остальные пункты (#8–11)
