import { IsNotEmpty, IsString } from 'class-validator';

export class AddTelegramSourceDto {
  @IsString()
  @IsNotEmpty()
  username: string;
}
