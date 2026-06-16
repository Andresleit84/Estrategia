import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiCronService } from './ai-cron.service';
import { OkrCoachDto } from './dto/okr-coach.dto';
import { CheckInAssistantDto } from './dto/checkin-assistant.dto';
import { StrategyAdvisorDto } from './dto/strategy-advisor.dto';
import { RunAgentDto } from './dto/run-agent.dto';
import { SuggestOkrsDto } from './dto/suggest-okrs.dto';
import { SuggestInitiativesDto } from './dto/suggest-initiatives.dto';
import { DeliveryAdvisorDto } from './dto/delivery-advisor.dto';
import { SuggestDeliveryDto } from './dto/suggest-delivery.dto';
import { SuggestBacklogDto } from './dto/suggest-backlog.dto';
import { SuggestTeamOkrsDto } from './dto/suggest-team-okrs.dto';
import { SuggestDemoStrategyDto } from './dto/suggest-demo-strategy.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller('ai')
export class AiController {
  constructor(
    private readonly svc: AiService,
    private readonly cron: AiCronService,
  ) {}

  @Post('okr-coach')
  coachOkr(@Body() dto: OkrCoachDto) {
    return this.svc.coachOkr(dto);
  }

  @Post('checkin-assistant')
  checkinAssistant(@CurrentUser() user: UserSession, @Body() dto: CheckInAssistantDto) {
    return this.svc.checkinAssistant(user.organization_id, dto);
  }

  @Post('checkin-summary/:checkInId')
  generateCheckinSummary(@CurrentUser() user: UserSession, @Param('checkInId') checkInId: string) {
    return this.svc.generateCheckinSummary(user.organization_id, checkInId);
  }

  @Post('cycle-close-briefing/:cycleId')
  generateCycleCloseBriefing(@CurrentUser() user: UserSession, @Param('cycleId') cycleId: string) {
    return this.svc.generateCycleCloseBriefing(user.organization_id, cycleId);
  }

  @Get('cycle-close-briefing/:cycleId')
  getCycleCloseBriefing(@CurrentUser() user: UserSession, @Param('cycleId') cycleId: string) {
    return this.svc.getBriefingForCycle(user.organization_id, cycleId);
  }

  @Post('risk-sentinel')
  runRiskSentinel(@CurrentUser() user: UserSession, @Body() dto: RunAgentDto) {
    return this.svc.runRiskSentinel(user.organization_id, dto.cycle_id);
  }

  @Post('executive-briefing')
  generateExecutiveBriefing(@CurrentUser() user: UserSession, @Body() dto: RunAgentDto) {
    return this.svc.generateExecutiveBriefing(user.organization_id, user.user_id, dto.cycle_id);
  }

  @Post('alignment-audit')
  runAlignmentAudit(@CurrentUser() user: UserSession, @Body() dto: RunAgentDto) {
    return this.svc.runAlignmentAudit(user.organization_id, dto.cycle_id);
  }

  @Post('strategy-advisor')
  strategyAdvisor(@CurrentUser() user: UserSession, @Body() dto: StrategyAdvisorDto) {
    return this.svc.strategyAdvisor(user.organization_id, user.user_id, dto);
  }

  @Post('suggest-strategic-intents')
  suggestStrategicIntents(@CurrentUser() user: UserSession) {
    return this.svc.suggestStrategicIntents(user.organization_id);
  }

  @Post('suggest-okrs')
  suggestOkrs(@CurrentUser() user: UserSession, @Body() dto: SuggestOkrsDto) {
    return this.svc.suggestOkrs(user.organization_id, dto.cycle_id, dto.level, dto.cycle_type);
  }

  @Post('suggest-initiatives')
  suggestInitiatives(@CurrentUser() user: UserSession, @Body() dto: SuggestInitiativesDto) {
    return this.svc.suggestInitiatives(user.organization_id, dto.cycle_id);
  }

  @Post('suggest-delivery')
  suggestDelivery(@CurrentUser() user: UserSession, @Body() dto: SuggestDeliveryDto) {
    return this.svc.suggestDelivery(user.organization_id, dto.program_id);
  }

  @Post('suggest-backlog')
  suggestBacklog(@CurrentUser() user: UserSession, @Body() dto: SuggestBacklogDto) {
    return this.svc.suggestBacklog(user.organization_id, dto.cycle_id);
  }

  @Post('suggest-team-okrs')
  suggestTeamOkrs(@CurrentUser() user: UserSession, @Body() dto: SuggestTeamOkrsDto) {
    return this.svc.suggestTeamOkrsForGaps(user.organization_id, dto.cycle_id);
  }

  @Post('delivery-advisor')
  deliveryAdvisor(@CurrentUser() user: UserSession, @Body() dto: DeliveryAdvisorDto) {
    return this.svc.deliveryAdvisor(user.organization_id, user.user_id, dto);
  }

  @Post('convert-agreement-epic')
  convertAgreementToEpic(@CurrentUser() user: UserSession, @Body('agreement_id') agreementId: string) {
    return this.svc.convertAgreementToEpic(user.organization_id, agreementId);
  }

  @Post('suggest-demo-strategy')
  suggestDemoStrategy(@Body() dto: SuggestDemoStrategyDto) {
    return this.svc.suggestDemoStrategy(dto.company, dto.industry ?? '', dto.challenge);
  }

  @Get('briefings')
  getBriefings(@CurrentUser() user: UserSession, @Query('type') type?: string) {
    return this.svc.getBriefings(user.organization_id, type);
  }

  @Get('briefings/:id')
  getBriefing(@CurrentUser() user: UserSession, @Param('id') id: string) {
    return this.svc.getBriefing(user.organization_id, id);
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: UserSession) {
    return this.svc.getConversations(user.organization_id, user.user_id);
  }

  @Post('engagement-analysis/:cycleId')
  generateEngagementAnalysis(@CurrentUser() user: UserSession, @Param('cycleId') cycleId: string) {
    return this.svc.generateEngagementAnalysis(user.organization_id, cycleId);
  }

  @Get('engagement-analysis/:cycleId')
  getEngagementAnalysis(@CurrentUser() user: UserSession, @Param('cycleId') cycleId: string) {
    return this.svc.getEngagementAnalysis(user.organization_id, cycleId);
  }

  @Post('personal-briefing')
  generatePersonalBriefing(@CurrentUser() user: UserSession) {
    return this.svc.generatePersonalBriefing(user.organization_id, user.user_id);
  }

  @Get('personal-briefing/latest')
  getLatestPersonalBriefing(@CurrentUser() user: UserSession) {
    return this.svc.getLatestPersonalBriefing(user.organization_id, user.user_id);
  }

  @Post('first-day-narrative')
  generateFirstDayNarrative(@CurrentUser() user: UserSession) {
    return this.svc.generateFirstDayNarrative(user.organization_id, user.user_id);
  }

  /** Manual trigger — send notification immediately for the current org */
  @Post('notifications/trigger/:type')
  triggerNotification(
    @CurrentUser() user: UserSession,
    @Param('type') type: string,
  ) {
    return this.cron.triggerForOrg(user.organization_id, user.user_id, type);
  }
}
