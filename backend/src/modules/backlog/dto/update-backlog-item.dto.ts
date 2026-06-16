import { Transform } from 'class-transformer';
import {
  IsString, MinLength, MaxLength, IsOptional, IsUUID,
  IsIn, IsInt, Min,
} from 'class-validator';

export class UpdateBacklogItemDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(5000)
  acceptance_criteria?: string;

  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

  @IsOptional()
  @IsIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

  @IsOptional()
  @IsInt()
  @Min(0)
  story_points?: number;

  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @IsOptional()
  @IsUUID()
  initiative_id?: string | null;

  @IsOptional()
  @IsUUID()
  sprint_id?: string | null;

  @IsOptional()
  @IsUUID()
  assignee_id?: string | null;

  @IsOptional()
  @IsUUID()
  cycle_id?: string | null;
}
