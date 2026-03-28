import { ApiProperty } from '@nestjs/swagger';

export class TelegramLinkResponseDto {
  @ApiProperty({ description: 'Ссылка для открытия бота в Telegram' })
  url: string;

  @ApiProperty({ description: 'Время истечения токена' })
  expiresAt: Date;
}
