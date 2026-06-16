import { IsOptional, IsUUID } from 'class-validator';

export class SuggestBacklogDto {
  @IsOptional()
  @IsUUID()
  cycle_id?: string;
}
