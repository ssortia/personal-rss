import { Body, Controller, Delete, Get, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

  @Get('sources/:sourceId')
  @ApiOperation({ summary: 'Настройки источника (merge поверх глобальных)' })
  @ApiResponse({
    status: 200,
    description: 'Настройки источника с подстановкой глобальных дефолтов',
  })
  @ApiNotFoundResponse({ description: 'Источник не найден в подписках пользователя' })
  getSourceSettings(@CurrentUser() user: User, @Param('sourceId') sourceId: string) {
    return this.preferencesService.getSourceSettings(user.id, sourceId);
  }

  @Patch('sources/:sourceId')
  @ApiOperation({ summary: 'Обновить per-source настройки (partial merge)' })
  @ApiResponse({ status: 200, description: 'Обновлённые настройки источника' })
  @ApiNotFoundResponse({ description: 'Источник не найден в подписках пользователя' })
  updateSourceSettings(
    @CurrentUser() user: User,
    @Param('sourceId') sourceId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.preferencesService.updateSourceSettings(user.id, sourceId, dto);
  }

  @Delete('sources/:sourceId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Сбросить per-source настройки — источник использует глобальные' })
  @ApiResponse({ status: 204, description: 'Настройки сброшены' })
  @ApiNotFoundResponse({ description: 'Источник не найден в подписках пользователя' })
  resetSourceSettings(@CurrentUser() user: User, @Param('sourceId') sourceId: string) {
    return this.preferencesService.resetSourceSettings(user.id, sourceId);
  }
}
