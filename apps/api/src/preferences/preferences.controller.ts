import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PreferencesService } from './preferences.service';

@ApiTags('preferences')
@Controller('preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Список всех доступных категорий' })
  getCategories() {
    return this.preferencesService.getCategories();
  }

  @Get()
  @ApiOperation({ summary: 'Глобальные настройки пользователя (интересы, категории, порог)' })
  getSettings(@CurrentUser() user: User) {
    return this.preferencesService.getSettings(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Обновить глобальные настройки (partial merge)' })
  updateSettings(@CurrentUser() user: User, @Body() dto: UpdatePreferencesDto) {
    return this.preferencesService.updateSettings(user.id, dto);
  }
}
