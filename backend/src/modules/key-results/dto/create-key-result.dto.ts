import { IsString, IsOptional, IsUUID, IsEnum, IsNumber, IsIn, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export enum KrType {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
  MAINTAIN = 'MAINTAIN',
  ACHIEVE  = 'ACHIEVE',
}

export const KR_CADENCES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY'] as const;
export type KrCadence = typeof KR_CADENCES[number];

export class CreateKeyResultDto {
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

  @IsEnum(KrType)
  @IsOptional()
  type?: KrType;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(50)
  @IsOptional()
  metric_unit?: string;

  @IsNumber()
  @IsOptional()
  start_value?: number;

  @IsNumber()
  target_value: number;

  @IsUUID()
  @IsOptional()
  owner_id?: string;

  @IsUUID()
  @IsOptional()
  team_id?: string;

  @IsIn(KR_CADENCES)
  @IsOptional()
  check_in_cadence?: KrCadence;
}
