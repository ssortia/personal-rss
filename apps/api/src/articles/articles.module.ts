import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ArticlesRepository } from './articles.repository';

@Module({
  imports: [PrismaModule],
  providers: [ArticlesRepository],
  exports: [ArticlesRepository],
})
export class ArticlesModule {}
