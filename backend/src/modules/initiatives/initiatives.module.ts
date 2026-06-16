import { Module } from '@nestjs/common';
import { InitiativesService } from './initiatives.service';
import { InitiativesController, KrInitiativesController } from './initiatives.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InitiativesController, KrInitiativesController],
  providers: [InitiativesService],
  exports: [InitiativesService],
})
export class InitiativesModule {}
