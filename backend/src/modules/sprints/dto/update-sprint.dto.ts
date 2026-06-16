import { Transform } from 'class-transformer';
import {
  IsString, IsOptional, IsInt, Min, IsDateString,
  MinLength, MaxLength,
} from 'class-validator';

export class UpdateSprintDto {
  @IsOptional()
  @Transform(({ value }: { value: any }) => value?.trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: any }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(500)
  goal?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  planned_velocity?: number;
}
