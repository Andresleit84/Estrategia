import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class StrategyAdvisorDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsUUID()
  conversation_id?: string;

  @IsOptional()
  @IsUUID()
  cycle_id?: string;
}
