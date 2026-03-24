import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateThresholdDto } from './dto/update-threshold.dto';
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
  @ApiOperation({ summary: 'Выбранные категории пользователя' })
  getUserPreferences(@CurrentUser() user: User) {
    return this.preferencesService.getUserPreferences(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Заменить весь набор выбранных категорий' })
  updatePreferences(@CurrentUser() user: User, @Body() dto: UpdatePreferencesDto) {
    return this.preferencesService.updatePreferences(user.id, dto.categoryIds);
  }

  @Get('threshold')
  @ApiOperation({ summary: 'Получить порог релевантности пользователя' })
  getThreshold(@CurrentUser() user: User) {
    return this.preferencesService.getThreshold(user.id);
  }

  @Patch('threshold')
  @ApiOperation({ summary: 'Обновить порог релевантности' })
  updateThreshold(@CurrentUser() user: User, @Body() dto: UpdateThresholdDto) {
    return this.preferencesService.updateThreshold(user.id, dto.threshold);
  }
}
