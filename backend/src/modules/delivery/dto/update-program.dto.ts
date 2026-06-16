import { Transform } from 'class-transformer';
import {
  IsString, MinLength, MaxLength, IsOptional, IsUUID, IsIn,
} from 'class-validator';

export class UpdateProgramDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  cycle_id?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
  status?: string;
}
