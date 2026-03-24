import { IsBoolean } from 'class-validator';

export class ToggleSourceDto {
  @IsBoolean()
  isActive!: boolean;
}
