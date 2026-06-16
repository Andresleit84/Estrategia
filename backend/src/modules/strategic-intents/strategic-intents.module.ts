import { Module } from '@nestjs/common';
import { StrategicIntentsController } from './strategic-intents.controller';
import { StrategicIntentsService } from './strategic-intents.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [StrategicIntentsController],
  providers: [StrategicIntentsService],
})
export class StrategicIntentsModule {}
