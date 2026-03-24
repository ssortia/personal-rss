import { IsArray, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  relevanceThreshold?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  interestsText?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCategories?: string[];
}
