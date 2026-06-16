import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SectorAssessmentController } from './sector-assessment.controller';
import { SectorAssessmentService } from './sector-assessment.service';
import { DatabaseModule } from '../../database/database.module';
import { PdfService } from '../reports/pdf.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [SectorAssessmentController],
  providers: [SectorAssessmentService, PdfService],
})
export class SectorAssessmentModule {}
