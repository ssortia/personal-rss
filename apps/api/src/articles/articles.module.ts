import { Module } from '@nestjs/common';

import { PreferencesModule } from '../preferences/preferences.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ArticlesController } from './articles.controller';
import { ArticlesRepository } from './articles.repository';
import { ArticlesService } from './articles.service';

@Module({
  imports: [PrismaModule, PreferencesModule],
  controllers: [ArticlesController],
  providers: [ArticlesService, ArticlesRepository],
  exports: [ArticlesRepository],
})
export class ArticlesModule {}
