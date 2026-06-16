import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { CycleType } from './create-cycle.dto';

export class UpdateCycleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CycleType)
  @IsOptional()
  type?: CycleType;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;
}
