import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, ParseUUIDPipe, HttpCode, ForbiddenException,
  UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { SectorAssessmentService } from './sector-assessment.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateThreatDto } from './dto/update-threat.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller('sector-assessment')
export class SectorAssessmentController {
  constructor(private readonly svc: SectorAssessmentService) {}

  // ─── Sessions ─────────────────────────────────────────────────────────────

  @Get('sessions')
  findAllSessions(@CurrentUser() user: UserSession) {
    return this.svc.findAllSessions(user.organization_id);
  }

  @Post('sessions')
  @HttpCode(201)
  createSession(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateSessionDto,
  ) {
    return this.svc.createSession(user.organization_id, user.user_id, dto);
  }

  @Get('sessions/my')
  findMySession(@CurrentUser() user: UserSession) {
    return this.svc.findMyParticipantSession(user.organization_id, user.user_id);
  }

  @Get('sessions/:id')
  findSession(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findSession(user.organization_id, id);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  deleteSession(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deleteSession(user.organization_id, id);
  }

  @Get('sessions/:id/consolidation')
  sessionConsolidation(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getSessionConsolidation(user.organization_id, id);
  }

  @Patch('sessions/:id/calibrate')
  @HttpCode(200)
  calibrateSession(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { scores: Record<string, number> },
  ) {
    return this.svc.calibrateSession(user.organization_id, id, body.scores);
  }

  @Post('sessions/:id/documents')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadDocument(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('doc_type') docType: string,
  ) {
    return this.svc.uploadDocument(
      user.organization_id, id, user.user_id,
      user.name ?? user.email, file, docType,
    );
  }

  @Delete('sessions/:id/documents/:docId')
  @HttpCode(200)
  deleteDocument(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId') docId: string,
  ) {
    return this.svc.deleteDocument(user.organization_id, id, docId);
  }

  @Post('sessions/:id/analyze')
  @HttpCode(200)
  analyzeSession(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.analyzeSession(user.organization_id, id);
  }

  @Get('sessions/:id/pdf')
  async downloadSessionPdf(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const buf = await this.svc.generateSessionPdf(user.organization_id, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="diagnostico-${id.slice(0, 8)}.pdf"`);
    res.send(buf);
  }

  @Post('sessions/:id/assessments')
  @HttpCode(201)
  createAssessmentInSession(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.svc.create(user.organization_id, user.user_id, dto, id);
  }

  @Get('sessions/:id/participants')
  getParticipants(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getSessionParticipants(user.organization_id, id);
  }

  @Post('sessions/:id/participants')
  @HttpCode(201)
  addParticipant(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { user_id: string },
  ) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.svc.addSessionParticipant(user.organization_id, id, body.user_id, user.user_id);
  }

  @Post('sessions/:id/participants/notify')
  @HttpCode(200)
  notifyParticipants(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.svc.notifySessionParticipants(user.organization_id, id, user.user_id);
  }

  @Delete('sessions/:id/participants/:userId')
  @HttpCode(200)
  removeParticipant(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.svc.removeSessionParticipant(user.organization_id, id, userId);
  }

  @Get('sessions/:id/assessments')
  findSessionAssessments(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findBySession(user.organization_id, id);
  }

  // ─── Org-level consolidation (legacy) ─────────────────────────────────────

  @Get('consolidation')
  consolidation(@CurrentUser() user: UserSession) {
    return this.svc.consolidation(user.organization_id);
  }

  @Get('consolidation/plan')
  latestPlan(@CurrentUser() user: UserSession) {
    return this.svc.getLatestPlan(user.organization_id);
  }

  @Post('consolidation/plan')
  @HttpCode(200)
  generatePlan(@CurrentUser() user: UserSession) {
    return this.svc.generateConsolidatedPlan(user.organization_id);
  }

  // ─── Individual assessments ────────────────────────────────────────────────

  @Get()
  findAll(@CurrentUser() user: UserSession) {
    return this.svc.findAll(user.organization_id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOne(user.organization_id, id);
  }

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  @Patch(':id/threats')
  updateThreat(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateThreatDto,
  ) {
    return this.svc.updateThreat(user.organization_id, id, dto);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.complete(user.organization_id, id);
  }

  @Post(':id/analyze')
  @HttpCode(200)
  analyze(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.analyzeSession(user.organization_id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.remove(user.organization_id, id);
  }
}
