import { Transform } from 'class-transformer';
import {
  IsString, MinLength, MaxLength, IsOptional, IsEnum, IsDateString, IsUUID,
} from 'class-validator';

export enum InitiativeStatus {
  TODO        = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE        = 'DONE',
  CANCELLED   = 'CANCELLED',
}

export class UpdateInitiativeDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(InitiativeStatus)
  status?: InitiativeStatus;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @IsOptional()
  @IsUUID()
  sprint_id?: string;
}
