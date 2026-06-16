import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';

export enum TicketCategory {
  GENERAL  = 'general',
  BUG      = 'bug',
  FEATURE  = 'feature',
  BILLING  = 'billing',
  ACCESS   = 'access',
  OTHER    = 'other',
}

export class CreateTicketDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsEnum(TicketCategory)
  @IsOptional()
  category?: TicketCategory;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  body: string;
}
