import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { FeedService } from './feed.service';
import { RssFeedExceptionFilter } from './rss-feed-exception.filter';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить токен персонального RSS-фида' })
  getToken(@CurrentUser() user: User) {
    return this.feedService.getToken(user.id);
  }

  @Post('token/reset')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Сбросить и выдать новый токен фида' })
  resetToken(@CurrentUser() user: User) {
    return this.feedService.resetToken(user.id);
  }

  @Get(':token')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  @UseFilters(RssFeedExceptionFilter)
  @ApiOperation({ summary: 'Публичный RSS-фид по токену (без авторизации)' })
  getRssFeed(@Param('token') token: string): Promise<string> {
    return this.feedService.getRssFeed(token);
  }
}
