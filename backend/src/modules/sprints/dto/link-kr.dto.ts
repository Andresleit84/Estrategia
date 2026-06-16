import { IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class LinkKrDto {
  @IsUUID()
  kr_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  expected_contribution?: number;
}
