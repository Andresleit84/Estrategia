import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @IsString() @MaxLength(100)
  name: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsUUID()
  parentTeamId?: string;
}
