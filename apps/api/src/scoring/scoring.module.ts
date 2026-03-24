import { Module } from '@nestjs/common';

import { GroqGate } from './groq.gate';
import { ScoringService } from './scoring.service';

@Module({
  providers: [GroqGate, ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
