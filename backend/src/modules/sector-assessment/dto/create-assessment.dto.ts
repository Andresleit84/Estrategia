import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';

export enum EngagementType {
  DIAGNOSTIC    = 'DIAGNOSTIC',
  ANNUAL_REVIEW = 'ANNUAL_REVIEW',
  FOLLOWUP      = 'FOLLOWUP',
}

export class CreateAssessmentDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title: string;

  @IsEnum(EngagementType)
  @IsOptional()
  engagement_type?: EngagementType;
}
