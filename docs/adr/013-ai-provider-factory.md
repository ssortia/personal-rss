# 013. Поддержка нескольких AI-провайдеров через фабричный DI-провайдер

**Статус:** Принято

**Дата:** 2026-04-04

## Контекст

AI-оценка статей изначально была жёстко привязана к Groq (`GroqGate`). Потребовалась возможность переключаться на альтернативные провайдеры (OpenRouter) через переменную окружения без изменения кода. В проекте уже существовал интерфейс `AiGateway` и токен `AI_GATEWAY` для DI.

## Рассмотренные варианты

- **Вариант A — factory provider в `ScoringModule`**: регистрировать оба gate как провайдеры, factory выбирает нужный по `AI_PROVIDER` из env. Circuit breaker и retry-логика вынесены в абстрактный базовый класс `AbstractAiGate`.
  - Плюсы: стандартный NestJS-паттерн, переключение без изменения кода, оба gate lightweight (только HTTP-клиент или null)
  - Минусы: оба gate инстанцируются при старте, неиспользуемый хранит `client=null`

- **Вариант B — условный импорт модуля**: динамически импортировать `GroqModule` или `OpenRouterModule` в зависимости от env.
  - Плюсы: только один gate инстанцируется
  - Минусы: усложняет граф модулей, нестандартный паттерн для простой задачи

- **Вариант C — один gate с условной логикой внутри**: единый `AiGate` переключается между SDK на основе `AI_PROVIDER`.
  - Минусы: нарушает Single Responsibility, тестировать сложнее

## Решение

Выбран **Вариант A**. Оба gate (GroqGate, OpenRouterGate) наследуют `AbstractAiGate`, который содержит circuit breaker и retry-логику (Template Method Pattern). `ScoringModule` регистрирует factory provider, выбирающий gate по `AI_PROVIDER`.

```typescript
{
  provide: AI_GATEWAY,
  useFactory: (groq: GroqGate, openRouter: OpenRouterGate) =>
    getEnv().AI_PROVIDER === 'openrouter' ? openRouter : groq,
  inject: [GroqGate, OpenRouterGate],
}
```

Переменные окружения: `AI_PROVIDER` (enum `groq|openrouter`, default `groq`), `OPENROUTER_API_KEY`, `AI_MODEL` (переопределяет дефолтную модель провайдера).

## Последствия

- Добавление нового провайдера: создать класс, расширяющий `AbstractAiGate`, добавить в `ScoringModule`.
- Смена провайдера без деплоя: изменить `AI_PROVIDER` в env и перезапустить.
- Оба gate инстанцируются всегда — намеренно, стоимость минимальна (конструктор проверяет наличие ключа).
