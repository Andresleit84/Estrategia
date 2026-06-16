import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class CreateDiagnosticDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 120)
  orgName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{2,3}$/)
  countryCode: string;

  @IsString()
  @IsNotEmpty()
  countryName: string;
}
