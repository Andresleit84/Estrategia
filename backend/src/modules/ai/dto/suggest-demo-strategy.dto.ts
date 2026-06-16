import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SuggestDemoStrategyDto {
  @IsString()
  @MaxLength(120)
  company: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  industry?: string;

  @IsString()
  @MaxLength(600)
  challenge: string;
}
