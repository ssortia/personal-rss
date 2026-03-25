import { Module } from '@nestjs/common';

import { ArticlesModule } from '../articles/articles.module';
import { PreferencesModule } from '../preferences/preferences.module';

import { AI_GATEWAY } from './ai-gateway.interface';
import { ArticlesScoringService } from './articles-scoring.service';
import { GroqGate } from './groq.gate';
import { ScoringService } from './scoring.service';

@Module({
  imports: [ArticlesModule, PreferencesModule],
  providers: [
    GroqGate,
    // AI_GATEWAY → GroqGate: легко заменить провайдера без изменения ScoringService
    { provide: AI_GATEWAY, useExisting: GroqGate },
    ScoringService,
    ArticlesScoringService,
  ],
  exports: [ScoringService, ArticlesScoringService],
})
export class ScoringModule {}
