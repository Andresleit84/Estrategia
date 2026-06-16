import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiCronService } from './ai-cron.service';
import { ConsultantModule } from '../consultant/consultant.module';

@Module({
  imports: [forwardRef(() => ConsultantModule)],
  controllers: [AiController],
  providers: [AiService, AiCronService],
  exports: [AiService, AiCronService],
})
export class AiModule {}
