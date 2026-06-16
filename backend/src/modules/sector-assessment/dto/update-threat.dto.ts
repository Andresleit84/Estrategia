import { Transform } from 'class-transformer';
import {
  IsString, IsOptional, IsEnum, IsNumber, IsArray,
  IsInt, Min, Max, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BenchmarkType {
  BELOW = 'BELOW',
  AT    = 'AT',
  ABOVE = 'ABOVE',
}

export class DimensionScoreDto {
  @IsString()
  dimension_key: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  score?: number;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

export class UpdateThreatDto {
  @IsString()
  threat_key: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  overall_score?: number;

  @IsEnum(BenchmarkType)
  @IsOptional()
  benchmark?: BenchmarkType;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  evidence?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  ai_insights?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DimensionScoreDto)
  @IsOptional()
  dimensions?: DimensionScoreDto[];
}
