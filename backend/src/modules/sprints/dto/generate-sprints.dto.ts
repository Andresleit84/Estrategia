import { IsUUID, IsInt, Min, Max, IsOptional, IsDateString } from 'class-validator';

export class GenerateSprintsDto {
  @IsUUID()
  cycle_id: string;

  @IsUUID()
  team_id: string;

  @IsInt()
  @Min(1)
  @Max(4)
  sprint_length_weeks: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  planned_velocity?: number;

  @IsOptional()
  @IsDateString()
  start_from?: string;
}
