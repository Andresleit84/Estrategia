import { IsString } from 'class-validator';

export class SuggestTeamOkrsDto {
  @IsString()
  cycle_id: string;
}
