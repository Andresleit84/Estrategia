import { IsString, IsOptional, IsUUID, IsEnum, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export enum ObjectiveLevel {
  COMPANY    = 'COMPANY',
  AREA       = 'AREA',
  TEAM       = 'TEAM',
  INDIVIDUAL = 'INDIVIDUAL',
}

export class CreateObjectiveDto {
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

  @IsEnum(ObjectiveLevel)
  @IsOptional()
  level?: ObjectiveLevel;

  @IsUUID()
  cycle_id: string;

  @IsUUID()
  @IsOptional()
  parent_objective_id?: string;

  @IsUUID()
  @IsOptional()
  owner_id?: string;

  @IsUUID()
  @IsOptional()
  team_id?: string;

  @IsUUID()
  @IsOptional()
  strategic_intent_id?: string;
}
