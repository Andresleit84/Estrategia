import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';
import { DemoService } from './demo.service';

class SeedDemoDto {
  @IsUUID()
  organizationId!: string;
}

class ResetObjectivesDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  cycleId!: string;
}

@Controller('demo')
export class DemoController {
  constructor(private readonly svc: DemoService) {}

  @Post('seed')
  @HttpCode(200)
  seed(@Body() dto: SeedDemoDto, @CurrentUser() user: UserSession) {
    return this.svc.seedOrg(dto.organizationId, user.user_id);
  }

  @Post('clean')
  @HttpCode(200)
  clean(@Body() dto: SeedDemoDto, @CurrentUser() user: UserSession) {
    return this.svc.cleanOrg(dto.organizationId, user.user_id);
  }

  @Post('reset-objectives')
  @HttpCode(200)
  resetObjectives(@Body() dto: ResetObjectivesDto, @CurrentUser() user: UserSession) {
    return this.svc.resetDemoObjectives(dto.organizationId, dto.cycleId, user.user_id);
  }
}
