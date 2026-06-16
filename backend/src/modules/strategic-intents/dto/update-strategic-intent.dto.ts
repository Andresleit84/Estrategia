import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { IntentCategory } from './create-strategic-intent.dto';

export enum IntentStatus {
  DRAFT     = 'DRAFT',
  ACTIVE    = 'ACTIVE',
  ACHIEVED  = 'ACHIEVED',
  CANCELLED = 'CANCELLED',
}

export class UpdateStrategicIntentDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @IsOptional()
  title?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  horizon_years?: number;

  @IsInt()
  @Min(2024)
  @Max(2050)
  @IsOptional()
  target_year?: number;

  @IsEnum(IntentCategory)
  @IsOptional()
  category?: IntentCategory;

  @IsEnum(IntentStatus)
  @IsOptional()
  status?: IntentStatus;
}
