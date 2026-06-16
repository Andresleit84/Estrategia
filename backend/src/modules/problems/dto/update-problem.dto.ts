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
import { ProblemCategory } from './create-problem.dto';

export enum ProblemStatus {
  IDENTIFIED       = 'IDENTIFIED',
  BEING_ADDRESSED  = 'BEING_ADDRESSED',
  RESOLVED         = 'RESOLVED',
  DEPRIORITIZED    = 'DEPRIORITIZED',
}

export class UpdateProblemDto {
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

  @IsEnum(ProblemCategory)
  @IsOptional()
  category?: ProblemCategory;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  severity?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  frequency?: number;

  @IsEnum(ProblemStatus)
  @IsOptional()
  status?: ProblemStatus;
}
