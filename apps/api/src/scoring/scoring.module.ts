import { Module } from '@nestjs/common';

import { ArticlesModule } from '../articles/articles.module';
import { getEnv } from '../config/env';
import { PreferencesModule } from '../preferences/preferences.module';

import { AI_GATEWAY } from './ai-gateway.interface';
import { ArticlesScoringService } from './articles-scoring.service';
import { GroqGate } from './groq.gate';
import { OpenRouterGate } from './open-router.gate';
import { ScoringService } from './scoring.service';

@Module({
  imports: [ArticlesModule, PreferencesModule],
  providers: [
    GroqGate,
    OpenRouterGate,
    {
      provide: AI_GATEWAY,
      /**
       * Оба gate инстанцируются при старте модуля — это намеренно и дёшево:
       * конструктор только читает env-переменную и создаёт HTTP-клиент (или null).
       * Factory выбирает активный gate по AI_PROVIDER без lazy-инициализации.
       * Неактивный gate хранит client=null и никогда не вызывает внешнее API.
       */
      useFactory: (groq: GroqGate, openRouter: OpenRouterGate) =>
        getEnv().AI_PROVIDER === 'openrouter' ? openRouter : groq,
      inject: [GroqGate, OpenRouterGate],
    },
    ScoringService,
    ArticlesScoringService,
  ],
  exports: [ScoringService, ArticlesScoringService],
})
export class ScoringModule {}
