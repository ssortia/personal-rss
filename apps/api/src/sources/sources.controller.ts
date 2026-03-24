import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddSourceDto } from './dto/add-source.dto';
import { AddTelegramSourceDto } from './dto/add-telegram-source.dto';
import { ToggleSourceDto } from './dto/toggle-source.dto';
import { SourcesService } from './sources.service';

@ApiTags('sources')
@Controller('sources')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Добавить RSS/Atom-источник по URL' })
  addSource(@CurrentUser() user: User, @Body() dto: AddSourceDto) {
    return this.sourcesService.addSource(user.id, dto.url);
  }

  @Post('telegram')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Добавить публичный Telegram-канал по username' })
  addTelegramChannel(@CurrentUser() user: User, @Body() dto: AddTelegramSourceDto) {
    return this.sourcesService.addTelegramChannel(user.id, dto.username);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список источников текущего пользователя' })
  getUserSources(@CurrentUser() user: User) {
    return this.sourcesService.getUserSources(user.id);
  }

  @Patch(':id/toggle')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Включить или отключить источник' })
  toggleSource(
    @CurrentUser() user: User,
    @Param('id') sourceId: string,
    @Body() dto: ToggleSourceDto,
  ) {
    return this.sourcesService.toggleSource(user.id, sourceId, dto.isActive);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить источник из списка пользователя' })
  removeSource(@CurrentUser() user: User, @Param('id') sourceId: string) {
    return this.sourcesService.removeSource(user.id, sourceId);
  }
}
