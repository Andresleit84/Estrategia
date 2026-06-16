import { IsString, IsOptional, IsInt, IsUUID, IsArray, Min, Max } from 'class-validator';

export class AddCycleDto {
  @IsUUID()
  cycle_id: string;

  @IsString()
  year_label: string;

  @IsInt()
  @Min(1)
  @Max(20)
  year_number: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focus_areas?: string[];

  @IsOptional()
  @IsString()
  expected_outcomes?: string;
}
