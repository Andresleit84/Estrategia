import {
  Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { CheckInsService } from './check-ins.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller()
export class CheckInsController {
  constructor(private readonly svc: CheckInsService) {}

  // POST /key-results/:krId/check-ins
  @Post('key-results/:krId/check-ins')
  create(
    @CurrentUser() user: UserSession,
    @Param('krId', ParseUUIDPipe) krId: string,
    @Body() dto: CreateCheckInDto,
  ) {
    return this.svc.create(user.organization_id, krId, user.user_id, dto);
  }

  // GET /key-results/:krId/check-ins
  @Get('key-results/:krId/check-ins')
  getHistory(
    @CurrentUser() user: UserSession,
    @Param('krId', ParseUUIDPipe) krId: string,
  ) {
    return this.svc.getHistory(user.organization_id, krId);
  }

  // GET /key-results/:krId/predict
  @Get('key-results/:krId/predict')
  getPrediction(
    @CurrentUser() user: UserSession,
    @Param('krId', ParseUUIDPipe) krId: string,
  ) {
    return this.svc.getPrediction(user.organization_id, krId);
  }

  // GET /at-risk-krs
  @Get('at-risk-krs')
  getAtRiskKrs(
    @CurrentUser() user: UserSession,
    @Query('cycle_id') cycleId?: string,
  ) {
    return this.svc.getAtRiskKrs(user.organization_id, cycleId);
  }

  // GET /cadence-dashboard?cycle_id=xxx
  @Get('cadence-dashboard')
  getCadenceDashboard(
    @CurrentUser() user: UserSession,
    @Query('cycle_id') cycleId: string,
  ) {
    return this.svc.getCadenceDashboard(user.organization_id, cycleId);
  }

  // GET /notifications
  @Get('notifications')
  getNotifications(@CurrentUser() user: UserSession) {
    return this.svc.getNotifications(user.organization_id, user.user_id);
  }

  // PATCH /notifications/:id/read
  @Patch('notifications/:id/read')
  markRead(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.markNotificationRead(user.organization_id, user.user_id, id);
  }

  // PATCH /notifications/read-all
  @Patch('notifications/read-all')
  markAllRead(@CurrentUser() user: UserSession) {
    return this.svc.markAllNotificationsRead(user.organization_id, user.user_id);
  }
}
