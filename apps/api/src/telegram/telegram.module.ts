import { Module } from '@nestjs/common';

import { TelegramGate } from './telegram.gate';

@Module({
  providers: [TelegramGate],
  exports: [TelegramGate],
})
export class TelegramModule {}
