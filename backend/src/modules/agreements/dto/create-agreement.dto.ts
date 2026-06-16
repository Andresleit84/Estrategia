import { IsString, IsOptional, MaxLength, MinLength, IsIn, IsDateString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAgreementDto {
  @Transform(({ value }) => value?.trim())
  @IsString() @MinLength(3) @MaxLength(300)
  title: string;

  @IsOptional() @IsString() @MaxLength(3000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(500)
  source?: string;

  @IsOptional() @IsDateString()
  agreement_date?: string;

  @IsOptional() @IsDateString()
  due_date?: string;

  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;

  @IsOptional() @IsUUID()
  cycle_id?: string;

  @IsOptional() @IsUUID()
  owner_id?: string;
}
