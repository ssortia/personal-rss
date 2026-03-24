import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PreferencesController } from './preferences.controller';
import { PreferencesRepository } from './preferences.repository';
import { PreferencesService } from './preferences.service';

@Module({
  imports: [PrismaModule],
  controllers: [PreferencesController],
  providers: [PreferencesService, PreferencesRepository],
  exports: [PreferencesRepository],
})
export class PreferencesModule {}
