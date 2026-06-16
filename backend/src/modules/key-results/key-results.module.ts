import { Module } from '@nestjs/common';
import { KeyResultsController } from './key-results.controller';
import { KeyResultsService } from './key-results.service';

@Module({
  controllers: [KeyResultsController],
  providers: [KeyResultsService],
  exports: [KeyResultsService],
})
export class KeyResultsModule {}
