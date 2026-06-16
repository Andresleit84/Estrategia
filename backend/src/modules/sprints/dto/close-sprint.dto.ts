import { IsInt, Min, IsOptional } from 'class-validator';

export class CloseSprintDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  actual_velocity?: number;
}
