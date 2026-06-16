import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ConsultantService } from './consultant.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';
import { AiCronService } from '../ai/ai-cron.service';

@Controller('consultant')
export class ConsultantController {
  constructor(
    private readonly svc: ConsultantService,
    private readonly cron: AiCronService,
  ) {}

  @Get('clients')
  listClients(@CurrentUser() user: UserSession) {
    return this.svc.listClients(user.email);
  }

  @Post('clients')
  addClient(@CurrentUser() user: UserSession, @Body('org_id') orgId: string) {
    return this.svc.addClient(user.email, orgId);
  }

  @Delete('clients/:orgId')
  removeClient(@CurrentUser() user: UserSession, @Param('orgId') orgId: string) {
    return this.svc.removeClient(user.email, orgId);
  }

  @Put('clients/:orgId/digest')
  toggleDigest(
    @CurrentUser() user: UserSession,
    @Param('orgId') orgId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.svc.toggleDigest(user.email, orgId, enabled);
  }

  @Put('clients/:orgId/client-alerts')
  toggleClientAlerts(
    @CurrentUser() user: UserSession,
    @Param('orgId') orgId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.svc.toggleClientAlerts(user.email, orgId, enabled);
  }

  @Post('digest/trigger')
  triggerDigest(@CurrentUser() user: UserSession) {
    return this.cron.triggerConsultantDigest(user.email);
  }
}
