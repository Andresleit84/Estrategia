import { IsUUID, IsOptional, IsString, IsInt, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddMemberDto {
  @IsUUID()
  user_id: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString() @MaxLength(100)
  role_label?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
