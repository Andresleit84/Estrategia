import { Module } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { CheckInCronService } from './check-in-cron.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CheckInsController],
  providers: [CheckInsService, CheckInCronService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
