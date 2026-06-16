import { IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSessionDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1)
  @MaxLength(50)
  period_label: string;
}
