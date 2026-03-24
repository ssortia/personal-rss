import { Module } from '@nestjs/common';

import { ArticlesModule } from '../articles/articles.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SourcesController } from './sources.controller';
import { SourcesRepository } from './sources.repository';
import { SourcesService } from './sources.service';

@Module({
  imports: [PrismaModule, ArticlesModule],
  controllers: [SourcesController],
  providers: [SourcesService, SourcesRepository],
  exports: [SourcesService],
})
export class SourcesModule {}
