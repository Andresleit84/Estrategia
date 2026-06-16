import { IsString, IsOptional, IsIn, MaxLength, IsObject } from 'class-validator';

export class UpdateOrgDto {
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @IsOptional() @IsIn(['AGILE', 'TRADITIONAL', 'HYBRID'])
  mode?: string;

  @IsOptional() @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['GENERIC', 'COOPERATIVE_FINANCIAL', 'BANKING', 'INSURANCE', 'OTHER'])
  sector?: string;
}
