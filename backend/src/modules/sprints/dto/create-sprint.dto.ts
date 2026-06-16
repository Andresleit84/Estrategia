import { Transform } from 'class-transformer';
import {
  IsString, IsUUID, IsOptional, IsInt, Min, IsDateString,
  MinLength, MaxLength,
} from 'class-validator';

export class CreateSprintDto {
  @IsUUID()
  cycle_id: string;

  @IsUUID()
  team_id: string;

  @Transform(({ value }: { value: any }) => value?.trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @Transform(({ value }: { value: any }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(500)
  goal?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  planned_velocity?: number;
}
