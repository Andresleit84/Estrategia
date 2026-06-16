import { IsString, IsOptional, IsUUID, IsIn, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDependencyDto {
  @Transform(({ value }) => value?.trim())
  @IsString() @MinLength(5) @MaxLength(500)
  description: string;

  @IsIn(['INTERNAL','EXTERNAL','DECISION'])
  type: string;

  @IsOptional()
  @IsUUID()
  depends_on_id?: string;
}

export class UpdateDependencyDto {
  @IsOptional()
  @IsIn(['PENDING','IN_PROGRESS','RESOLVED','BLOCKED'])
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString() @MinLength(5) @MaxLength(500)
  description?: string;
}
