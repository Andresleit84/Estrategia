import { IsUUID } from 'class-validator';

export class SuggestDeliveryDto {
  @IsUUID()
  program_id: string;
}
