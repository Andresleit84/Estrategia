import { IsString, IsOptional, IsInt, IsIn, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export const BODY_TYPES = ['CONSEJO','COMITE','DIRECTORIO','JUNTA','ASAMBLEA','OTHER'] as const;

export class CreateBodyDto {
  @Transform(({ value }) => value?.trim())
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsIn(BODY_TYPES)
  type: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString() @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
