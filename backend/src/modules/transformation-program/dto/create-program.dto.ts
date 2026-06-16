import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateProgramDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(2020)
  @Max(2050)
  start_year: number;

  @IsInt()
  @Min(2020)
  @Max(2060)
  end_year: number;

  @IsOptional()
  @IsString()
  vision_statement?: string;
}
