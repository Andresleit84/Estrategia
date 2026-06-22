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

  // ── Guardrails (No Negociables) ─────────────────────────────────────────────

  @Get('guardrails')
  listGuardrails(@CurrentUser() user: UserSession) {
    return this.svc.listGuardrails(user.organization_id);
  }

  @Post('guardrails')
  createGuardrail(@CurrentUser() user: UserSession, @Body() body: Record<string, unknown>) {
    return this.svc.upsertGuardrail(user.organization_id, null, body);
  }

  @Patch('guardrails/:id')
  updateGuardrail(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.upsertGuardrail(user.organization_id, id, body);
  }

  @Delete('guardrails/:id')
  deleteGuardrail(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteGuardrail(user.organization_id, id);
  }

  // ── Board Decisions (Decisiones Solicitadas) ─────────────────────────────────

  @Get('board-decisions/:cycleId')
  listBoardDecisions(
    @CurrentUser() user: UserSession,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.svc.listBoardDecisions(user.organization_id, cycleId);
  }

  @Post('board-decisions')
  createBoardDecision(@CurrentUser() user: UserSession, @Body() body: Record<string, unknown>) {
    return this.svc.upsertBoardDecision(user.organization_id, null, body);
  }

  @Patch('board-decisions/:id')
  updateBoardDecision(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.upsertBoardDecision(user.organization_id, id, body);
  }

  @Delete('board-decisions/:id')
  deleteBoardDecision(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteBoardDecision(user.organization_id, id);
  }

  // ── KR Crítico toggle ────────────────────────────────────────────────────────

  @Patch('kr-critical/:krId')
  setKrCritical(
    @CurrentUser() user: UserSession,
    @Param('krId', ParseUUIDPipe) krId: string,
    @Body('is_critical') isCritical: boolean,
  ) {
    return this.svc.setKrCritical(user.organization_id, krId, isCritical);
  }

  @Get('cycle-krs/:cycleId')
  getCycleKRs(
    @CurrentUser() user: UserSession,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.svc.getCycleKRs(user.organization_id, cycleId);
  }

  // ── Board Sessions (Pulso Mensual) ───────────────────────────────────────────

  @Get('board-sessions')
  listBoardSessions(@CurrentUser() user: UserSession) {
    return this.svc.listBoardSessions(user.organization_id);
  }

  @Post('board-sessions')
  createBoardSession(@CurrentUser() user: UserSession, @Body() body: Record<string, unknown>) {
    return this.svc.createBoardSession(user.organization_id, body);
  }

  @Patch('board-sessions/:id')
  updateBoardSession(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.updateBoardSession(user.organization_id, id, body);
  }

  @Delete('board-sessions/:id')
  deleteBoardSession(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteBoardSession(user.organization_id, id);
  }

  // ── Guardrail quick status update ────────────────────────────────────────────

  @Patch('guardrails/:id/status')
  updateGuardrailStatus(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.updateGuardrailStatus(user.organization_id, id, body);
  }

  // ── Board Session Agreements (Acuerdos de sesión) ────────────────────────────

  @Get('board-sessions/:sessionId/agreements')
  listAgreements(
    @CurrentUser() user: UserSession,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.svc.listAgreements(user.organization_id, sessionId);
  }

  @Post('board-sessions/:sessionId/agreements')
  createAgreement(
    @CurrentUser() user: UserSession,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.upsertAgreement(user.organization_id, sessionId, null, body);
  }

  @Patch('board-agreements/:id')
  updateAgreement(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.upsertAgreement(user.organization_id, null, id, body);
  }

  @Patch('board-agreements/:id/toggle')
  toggleAgreement(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('completed') completed: boolean,
  ) {
    return this.svc.toggleAgreement(user.organization_id, id, completed);
  }

  @Delete('board-agreements/:id')
  deleteAgreement(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteAgreement(user.organization_id, id);
  }

  // ── Decision follow-up ───────────────────────────────────────────────────────

  @Patch('board-decisions/:id/followup')
  updateDecisionFollowup(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.updateDecisionFollowup(user.organization_id, id, body);
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
