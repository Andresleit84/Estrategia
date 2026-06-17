import { IsUUID } from 'class-validator';

export class SwitchOrgDto {
  @IsUUID()
  org_id: string;
}
