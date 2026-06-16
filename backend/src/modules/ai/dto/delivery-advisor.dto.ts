import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class DeliveryAdvisorDto {
  @IsOptional()
  @IsUUID()
  program_id?: string;

  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsUUID()
  conversation_id?: string;
}
