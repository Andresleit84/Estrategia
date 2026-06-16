import { IsString, IsIn } from 'class-validator';

export class SuggestOkrsDto {
  @IsString()
  cycle_id: string;

  @IsIn(['COMPANY', 'AREA', 'TEAM', 'INDIVIDUAL'])
  level: 'COMPANY' | 'AREA' | 'TEAM' | 'INDIVIDUAL';

  @IsIn(['CUSTOM', 'ANNUAL', 'QUARTERLY'])
  cycle_type: 'CUSTOM' | 'ANNUAL' | 'QUARTERLY';
}
