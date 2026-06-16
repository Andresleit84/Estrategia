import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';

export enum KrTypeCoach {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
  MAINTAIN = 'MAINTAIN',
  ACHIEVE  = 'ACHIEVE',
}

export class OkrCoachDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(KrTypeCoach)
  @IsOptional()
  type?: KrTypeCoach;

  @IsNumber()
  @IsOptional()
  target?: number;

  @IsString()
  @IsOptional()
  unit?: string;
}
