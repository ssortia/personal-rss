import { Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { SyncService } from './sync.service';

@ApiTags('sync')
@Controller('sync')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Запустить принудительный обход источников текущего пользователя' })
  triggerSync(@CurrentUser() user: User): { message: string } {
    // Запускаем асинхронно — ответ возвращается сразу, синхронизация идёт в фоне
    void this.syncService
      .syncForUser(user.id)
      .catch((err: unknown) =>
        this.logger.error(`Ошибка ручной синхронизации userId=${user.id}: ${String(err)}`),
      );
    return { message: 'Синхронизация запущена' };
  }
}
