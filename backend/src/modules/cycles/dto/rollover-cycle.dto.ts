import { IsUUID, IsArray, ArrayMinSize } from 'class-validator';

export class RolloverCycleDto {
  @IsUUID()
  to_cycle_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  objective_ids: string[];
}
