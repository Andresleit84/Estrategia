import { Transform } from 'class-transformer';
import {
  IsString, MinLength, MaxLength, IsOptional, IsUUID,
  IsDateString, IsArray, ArrayMaxSize,
} from 'class-validator';

export class CreateInitiativeDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  cycle_id?: string;

  @IsOptional()
  @IsUUID()
  team_id?: string;

  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(10)
  kr_ids?: string[];

  @IsOptional()
  @IsUUID()
  sprint_id?: string;

  @IsOptional()
  @IsUUID()
  primary_area_id?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  involved_area_ids?: string[];
}
