import { IsNumber, Max, Min } from 'class-validator';

export class UpdateThresholdDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold!: number;
}
