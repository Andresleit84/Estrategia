import { IsUUID } from 'class-validator';

export class LinkBacklogDto {
  @IsUUID()
  backlog_item_id: string;
}
