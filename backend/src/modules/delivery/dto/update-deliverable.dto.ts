import { Transform } from 'class-transformer';
import {
  IsString, MinLength, MaxLength, IsOptional, IsUUID, IsDateString, IsIn,
} from 'class-validator';

export class UpdateDeliverableDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  acceptance_criteria?: string;

  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'BLOCKED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  document_url?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  linked_objective_id?: string;

  @IsOptional()
  @IsUUID()
  linked_initiative_id?: string;
}
