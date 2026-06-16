import { IsNumber, IsOptional, IsString, IsEnum, Max, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export enum CheckInMood {
  GREAT     = 'GREAT',
  GOOD      = 'GOOD',
  NEUTRAL   = 'NEUTRAL',
  CONCERNED = 'CONCERNED',
  BLOCKED   = 'BLOCKED',
}

export class CreateCheckInDto {
  @IsNumber()
  current_value: number;

  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  confidence: number;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;

  @IsEnum(CheckInMood)
  @IsOptional()
  mood?: CheckInMood;
}
