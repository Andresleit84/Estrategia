import { IsOptional, IsUUID } from 'class-validator';

export class RunAgentDto {
  @IsOptional()
  @IsUUID()
  cycle_id?: string;
}
