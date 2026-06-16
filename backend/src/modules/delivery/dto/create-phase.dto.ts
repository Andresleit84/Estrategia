import { Transform } from 'class-transformer';
import {
  IsString, MinLength, MaxLength, IsOptional, IsDateString, IsInt, Min, IsUUID,
} from 'class-validator';

export class CreatePhaseDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  gate_criteria?: string;

  @IsOptional()
  @IsDateString()
  target_start_date?: string;

  @IsOptional()
  @IsDateString()
  target_end_date?: string;

  @IsOptional()
  @IsUUID()
  owner_id?: string;
}
