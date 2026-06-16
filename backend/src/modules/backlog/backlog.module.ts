import { Module } from '@nestjs/common';
import { BacklogController } from './backlog.controller';
import { BacklogService } from './backlog.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BacklogController],
  providers: [BacklogService],
  exports: [BacklogService],
})
export class BacklogModule {}
