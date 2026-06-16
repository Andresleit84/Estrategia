import { IsString, IsOptional, IsUUID, IsNumber, IsIn, Min, Max, MinLength, MaxLength } from 'class-validator';
import { KR_CADENCES } from './create-key-result.dto';
import { Transform } from 'class-transformer';

export class UpdateKeyResultDto {
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

  @IsNumber()
  @IsOptional()
  current_value?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidence?: number;

  @IsUUID()
  @IsOptional()
  owner_id?: string;

  @IsUUID()
  @IsOptional()
  team_id?: string;

  @IsIn(['INCREASE', 'DECREASE', 'MAINTAIN', 'ACHIEVE'])
  @IsOptional()
  type?: string;

  @IsString()
  @MaxLength(20)
  @IsOptional()
  metric_unit?: string;

  @IsNumber()
  @IsOptional()
  start_value?: number;

  @IsNumber()
  @IsOptional()
  target_value?: number;

  @IsIn(KR_CADENCES)
  @IsOptional()
  check_in_cadence?: string;
}
