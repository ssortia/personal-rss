import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PreferencesRepository } from '../preferences/preferences.repository';
import { ArticlesService } from './articles.service';
import { GetFeedDto } from './dto/get-feed.dto';

@ApiTags('articles')
@Controller('articles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly preferencesRepository: PreferencesRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Персональный фид статей с AI-фильтрацией' })
  async getFeed(@CurrentUser() user: User, @Query() dto: GetFeedDto) {
    const { threshold } = await this.preferencesRepository.getUserThreshold(user.id);
    return this.articlesService.getFeed(user.id, threshold, dto.cursor, dto.limit);
  }
}
