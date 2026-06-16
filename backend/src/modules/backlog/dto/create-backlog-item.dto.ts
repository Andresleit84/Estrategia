import { Transform } from 'class-transformer';
import {
  IsString, MinLength, MaxLength, IsOptional, IsUUID,
  IsIn, IsInt, Min,
} from 'class-validator';

export class CreateBacklogItemDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  title: string;

  @IsIn(['EPIC', 'FEATURE', 'STORY'])
  type: 'EPIC' | 'FEATURE' | 'STORY';

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
  @IsIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

  @IsOptional()
  @IsInt()
  @Min(0)
  story_points?: number;

  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @IsOptional()
  @IsUUID()
  initiative_id?: string;

  @IsOptional()
  @IsUUID()
  sprint_id?: string;

  @IsOptional()
  @IsUUID()
  assignee_id?: string;

  @IsOptional()
  @IsUUID()
  cycle_id?: string;
}
