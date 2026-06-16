import { Module } from '@nestjs/common';
import { TransformationProgramController } from './transformation-program.controller';
import { TransformationProgramService } from './transformation-program.service';

@Module({
  controllers: [TransformationProgramController],
  providers: [TransformationProgramService],
})
export class TransformationProgramModule {}
