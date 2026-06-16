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

export enum ProblemCategory {
  PEOPLE       = 'PEOPLE',
  PROCESS      = 'PROCESS',
  TECHNOLOGY   = 'TECHNOLOGY',
  MARKET       = 'MARKET',
  CULTURE      = 'CULTURE',
  FINANCIAL    = 'FINANCIAL',
  OPERATIONAL  = 'OPERATIONAL',
  OTHER        = 'OTHER',
}

export class CreateProblemDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  title: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsEnum(ProblemCategory)
  @IsOptional()
  category?: ProblemCategory;

  @IsInt()
  @Min(1)
  @Max(5)
  severity: number;

  @IsInt()
  @Min(1)
  @Max(5)
  frequency: number;
}
