import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InternalController],
})
export class InternalModule {}
