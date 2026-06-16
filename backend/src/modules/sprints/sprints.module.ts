import { Module } from '@nestjs/common';
import {
  SprintsController,
  CycleSprintsController,
  TeamVelocityController,
} from './sprints.controller';
import { SprintsService } from './sprints.service';

@Module({
  controllers: [SprintsController, CycleSprintsController, TeamVelocityController],
  providers: [SprintsService],
})
export class SprintsModule {}
