import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString } from 'class-validator';

const ALLOWED_PROVIDERS = ['google', 'github', 'yandex'] as const;

export class OAuthLoginDto {
  @ApiProperty({ example: 'google', enum: ALLOWED_PROVIDERS })
  @IsIn(ALLOWED_PROVIDERS)
  provider: string;

  @ApiProperty({ example: '1234567890', description: 'ID пользователя у провайдера' })
  @IsString()
  providerAccountId: string;

  @ApiProperty({ example: 'user@gmail.com', description: 'Email из профиля провайдера' })
  @IsEmail()
  email: string;
}
