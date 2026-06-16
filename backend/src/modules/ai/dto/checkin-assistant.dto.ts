import { IsUUID, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CheckInAssistantDto {
  @IsUUID()
  kr_id: string;

  @IsNumber()
  current_value: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;
}
