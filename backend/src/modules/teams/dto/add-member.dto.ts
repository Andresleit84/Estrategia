import { IsUUID, IsOptional, IsIn } from 'class-validator';

export class AddMemberDto {
  @IsUUID()
  user_id: string;

  @IsOptional() @IsIn(['LEAD', 'MEMBER', 'OBSERVER'])
  role?: string;
}
