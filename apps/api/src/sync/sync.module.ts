import { Module } from '@nestjs/common';

import { ArticlesModule } from '../articles/articles.module';
import { SourcesModule } from '../sources/sources.module';
import { TelegramModule } from '../telegram/telegram.module';

import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [SourcesModule, ArticlesModule, TelegramModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
