import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
