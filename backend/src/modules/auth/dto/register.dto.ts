import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn, Matches } from 'class-validator';

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(100)
  orgName: string;

  @IsString() @MinLength(2) @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'El slug solo puede contener letras minúsculas, números y guiones' })
  orgSlug: string;

  @IsOptional() @IsIn(['AGILE', 'TRADITIONAL', 'HYBRID'])
  orgMode?: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(8) @MaxLength(100)
  password: string;

  @IsString() @MinLength(2) @MaxLength(100)
  name: string;
}
