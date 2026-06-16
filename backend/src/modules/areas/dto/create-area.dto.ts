import { IsString, IsOptional, IsUUID, IsInt, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAreaDto {
  @Transform(({ value }) => value?.trim())
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString() @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a valid hex color' })
  color?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
