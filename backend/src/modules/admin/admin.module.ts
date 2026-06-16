import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminController],
  providers: [AdminService, PlatformAdminGuard],
})
export class AdminModule {}
