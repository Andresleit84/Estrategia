import { Module } from '@nestjs/common';
import { AiDiagnosticController } from './ai-diagnostic.controller';
import { AiDiagnosticService } from './ai-diagnostic.service';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  controllers: [AiDiagnosticController],
  providers: [AiDiagnosticService, PdfGeneratorService],
})
export class AiDiagnosticModule {}
