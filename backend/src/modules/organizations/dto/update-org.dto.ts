import { IsString, IsOptional, IsIn, MaxLength, IsObject, IsArray } from 'class-validator';

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

  @IsOptional() @IsString() @MaxLength(500)
  vision?: string;

  @IsOptional() @IsString() @MaxLength(500)
  mission?: string;

  @IsOptional() @IsArray()
  values_list?: string[];
}
