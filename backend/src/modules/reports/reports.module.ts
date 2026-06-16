import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PdfService } from './pdf.service';
import { PlanGuard } from '../../common/guards/plan.guard';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, PdfService, PlanGuard],
})
export class ReportsModule {}
