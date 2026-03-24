import { Module } from '@nestjs/common';

import { ArticlesModule } from '../articles/articles.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ScoringModule } from '../scoring/scoring.module';
import { TelegramModule } from '../telegram/telegram.module';
import { SourcesController } from './sources.controller';
import { SourcesRepository } from './sources.repository';
import { SourcesService } from './sources.service';

@Module({
  imports: [PrismaModule, ArticlesModule, PreferencesModule, ScoringModule, TelegramModule],
  controllers: [SourcesController],
  providers: [SourcesService, SourcesRepository],
  exports: [SourcesService],
})
export class SourcesModule {}
