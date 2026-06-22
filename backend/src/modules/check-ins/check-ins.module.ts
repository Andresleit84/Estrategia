import { Module } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { CheckInCronService } from './check-in-cron.service';
import { DatabaseModule } from '../../database/database.module';
import { TelegramModule } from '../../common/telegram/telegram.module';
import { RedisModule } from '../../common/redis/redis.module';
import { NotificationsModule } from '../../common/notifications/notifications.module';

@Module({
  imports: [DatabaseModule, TelegramModule, RedisModule, NotificationsModule],
  controllers: [CheckInsController],
  providers: [CheckInsService, CheckInCronService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
