import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Res, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';
import { PlanGuard } from '../../common/guards/plan.guard';
import { RequiresPlan, PlanFree } from '../../common/decorators/require-plan.decorator';

@ApiTags('reports')
@ApiCookieAuth('access_token')
@UseGuards(PlanGuard)
@RequiresPlan('PRO')
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('risk-dashboard')
  getRiskDashboard(@CurrentUser() user: UserSession, @Query('cycle_id') cycleId?: string) {
    return this.svc.getRiskDashboard(user.organization_id, cycleId);
  }

  @Get('executive-briefing')
  getExecutiveBriefingDashboard(@CurrentUser() user: UserSession, @Query('cycle_id') cycleId?: string) {
    return this.svc.getExecutiveBriefingDashboard(user.organization_id, cycleId);
  }

  @Get('alignment')
  getAlignmentReport(@CurrentUser() user: UserSession, @Query('cycle_id') cycleId?: string) {
    return this.svc.getAlignmentReport(user.organization_id, cycleId);
  }

  @Get('executive-dashboard')
  getExecutiveDashboard(@CurrentUser() user: UserSession, @Query('cycle_id') cycleId?: string) {
    return this.svc.getExecutiveDashboard(user.organization_id, cycleId);
  }

  @Get('cycle-health')
  getCycleHealth(@CurrentUser() user: UserSession, @Query('cycle_id') cycleId?: string) {
    return this.svc.getCycleHealth(user.organization_id, cycleId);
  }

  @Get('team-health')
  getTeamHealth(@CurrentUser() user: UserSession, @Query('cycle_id') cycleId?: string) {
    return this.svc.getTeamHealth(user.organization_id, cycleId);
  }

  @Get('portfolio')
  getPortfolio(@CurrentUser() user: UserSession, @Query('cycle_id') cycleId?: string) {
    return this.svc.getPortfolio(user.organization_id, cycleId);
  }

  @Get('consultant-portfolio')
  getConsultantPortfolio(@CurrentUser() user: UserSession) {
    return this.svc.getPortfolioMetrics(user.user_id);
  }

  @Get('area-checkin-status')
  getAreaCheckinStatus(@CurrentUser() user: UserSession) {
    return this.svc.getAreaCheckinStatus(user.organization_id);
  }

  @Get('commitment-ranking')
  getCommitmentRanking(@CurrentUser() user: UserSession) {
    return this.svc.getCommitmentRanking(user.organization_id);
  }

  @Get('weekly-trend')
  getWeeklyTrend(@CurrentUser() user: UserSession, @Query('cycle_id') cycleId?: string) {
    return this.svc.getWeeklyTrend(user.organization_id, cycleId);
  }

  @Get('cycle-projection')
  getCycleProjection(@CurrentUser() user: UserSession) {
    return this.svc.getCycleProjection(user.organization_id);
  }

  @Get('upcoming-milestones')
  getUpcomingMilestones(@CurrentUser() user: UserSession, @Query('days') days?: string) {
    return this.svc.getUpcomingMilestones(user.organization_id, days ? parseInt(days, 10) : 30);
  }

  @PlanFree()
  @Get('activity-feed')
  getActivityFeed(
    @CurrentUser() user: UserSession,
    @Query('cycle_id') cycleId?: string,
    @Query('team_id') teamId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getActivityFeed(user.organization_id, cycleId, teamId, limit ? parseInt(limit, 10) : 50);
  }

  @Get('close-report/:cycleId')
  getCloseReport(@CurrentUser() user: UserSession, @Param('cycleId') cycleId: string) {
    return this.svc.getCloseReport(user.organization_id, cycleId);
  }

  @Post('close-report/:cycleId')
  generateCloseReport(@CurrentUser() user: UserSession, @Param('cycleId') cycleId: string) {
    return this.svc.generateCloseReport(user.organization_id, cycleId, user.user_id);
  }

  @Get('export-csv/:cycleId')
  async exportCycleCsv(
    @CurrentUser() user: UserSession,
    @Param('cycleId') cycleId: string,
    @Res() res: Response,
  ) {
    // PDF: implementar en Hito 10 fase 2 con puppeteer
    const rows = await this.svc.exportCycleCsv(user.organization_id, cycleId);

    if (!rows.length) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="okrs-${cycleId}.csv"`);
      return res.send('');
    }

    const headers = Object.keys(rows[0] as Record<string, unknown>);
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.join(','),
      ...(rows as Record<string, unknown>[]).map((row) => headers.map((h) => escape(row[h])).join(',')),
    ];
    const csvString = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="okrs-${cycleId}.csv"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csvString);
  }

  @Get('export-pdf/:cycleId')
  exportPdf(
    @CurrentUser() user: UserSession,
    @Param('cycleId') cycleId: string,
    @Res() res: Response,
  ) {
    return this.svc.exportPdf(user.organization_id, cycleId, res);
  }

  @Get('export-pptx/:cycleId')
  exportPptx(
    @CurrentUser() user: UserSession,
    @Param('cycleId') cycleId: string,
    @Res() res: Response,
  ) {
    return this.svc.exportPptx(user.organization_id, cycleId, res);
  }

  @Get('engagement-roi/:cycleId')
  getEngagementRoi(
    @CurrentUser() user: UserSession,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.svc.getEngagementRoi(user.organization_id, cycleId);
  }

  @Get('security-audit')
  getSecurityAudit(
    @CurrentUser() user: UserSession,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getSecurityAudit(user.organization_id, limit ? parseInt(limit) : 100);
  }

  @Get('governance/pdf')
  exportGovernancePdf(
    @CurrentUser() user: UserSession,
    @Query('horizon') horizon: string = 'ANNUAL',
    @Res() res: Response,
  ) {
    return this.svc.exportGovernancePdf(user.organization_id, horizon, res);
  }

  @Get('governance')
  getGovernanceCalendar(
    @CurrentUser() user: UserSession,
    @Query('horizon') horizon?: string,
  ) {
    return this.svc.getGovernanceCalendar(user.organization_id, horizon ?? 'ANNUAL');
  }

  @Post('governance/activities')
  createGovernanceActivity(
    @CurrentUser() user: UserSession,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.createGovernanceActivity(user.organization_id, user.user_id, body);
  }

  @Patch('governance/activities/:id')
  updateGovernanceActivity(
    @CurrentUser() user: UserSession,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.updateGovernanceActivity(user.organization_id, id, body);
  }

  @Delete('governance/activities/:id')
  deleteGovernanceActivity(
    @CurrentUser() user: UserSession,
    @Param('id') id: string,
  ) {
    return this.svc.deleteGovernanceActivity(user.organization_id, id);
  }

  @Get('consejo-package/:cycleId')
  getConsejoPackage(
    @CurrentUser() user: UserSession,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.svc.getConsejoPackage(user.organization_id, cycleId);
  }

  @PlanFree()
  @Get('welcome-context')
  getWelcomeContext(
    @CurrentUser() user: UserSession,
    @Query('cycle_id') cycleId?: string,
  ) {
    return this.svc.getWelcomeContext(user.organization_id, user.user_id, cycleId);
  }
}
