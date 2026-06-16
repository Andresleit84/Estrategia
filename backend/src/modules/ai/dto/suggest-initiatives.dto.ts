import { IsUUID } from 'class-validator';

export class SuggestInitiativesDto {
  @IsUUID()
  cycle_id: string;
}
