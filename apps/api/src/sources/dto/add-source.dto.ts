import { IsUrl } from 'class-validator';

export class AddSourceDto {
  @IsUrl(
    { require_protocol: true },
    { message: 'Введите корректный URL с протоколом (http/https)' },
  )
  url: string;
}
