import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseUUIDPipe, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateDeliverableDto } from './dto/create-deliverable.dto';
import { UpdateDeliverableDto } from './dto/update-deliverable.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@ApiTags('delivery')
@ApiCookieAuth('access_token')
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly svc: DeliveryService) {}

  // GET /delivery
  @Get()
  listPrograms(@CurrentUser() user: UserSession) {
    return this.svc.listPrograms(user.organization_id);
  }

  // GET /delivery/upcoming
  @Get('upcoming')
  getUpcoming(
    @CurrentUser() user: UserSession,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.svc.getUpcoming(user.organization_id, days);
  }

  // POST /delivery
  @Post()
  createProgram(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateProgramDto,
  ) {
    return this.svc.createProgram(user.organization_id, user.user_id, dto);
  }

  // GET /delivery/:id
  @Get(':id')
  getProgram(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getProgram(user.organization_id, id);
  }

  // PATCH /delivery/:id
  @Patch(':id')
  updateProgram(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.svc.updateProgram(user.organization_id, id, dto);
  }

  // DELETE /delivery/:id
  @Delete(':id')
  deleteProgram(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deleteProgram(user.organization_id, id);
  }

  // POST /delivery/:id/phases
  @Post(':id/phases')
  createPhase(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePhaseDto,
  ) {
    return this.svc.createPhase(user.organization_id, id, dto);
  }

  // PATCH /delivery/phases/:phaseId
  @Patch('phases/:phaseId')
  updatePhase(
    @CurrentUser() user: UserSession,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.svc.updatePhase(user.organization_id, phaseId, dto);
  }

  // DELETE /delivery/phases/:phaseId
  @Delete('phases/:phaseId')
  deletePhase(
    @CurrentUser() user: UserSession,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
  ) {
    return this.svc.deletePhase(user.organization_id, phaseId);
  }

  // POST /delivery/phases/:phaseId/deliverables
  @Post('phases/:phaseId/deliverables')
  createDeliverable(
    @CurrentUser() user: UserSession,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
    @Body() dto: CreateDeliverableDto,
  ) {
    return this.svc.createDeliverable(user.organization_id, phaseId, user.user_id, dto);
  }

  // PATCH /delivery/deliverables/:delivId
  @Patch('deliverables/:delivId')
  updateDeliverable(
    @CurrentUser() user: UserSession,
    @Param('delivId', ParseUUIDPipe) delivId: string,
    @Body() dto: UpdateDeliverableDto,
  ) {
    return this.svc.updateDeliverable(user.organization_id, delivId, dto);
  }

  // DELETE /delivery/deliverables/:delivId
  @Delete('deliverables/:delivId')
  deleteDeliverable(
    @CurrentUser() user: UserSession,
    @Param('delivId', ParseUUIDPipe) delivId: string,
  ) {
    return this.svc.deleteDeliverable(user.organization_id, delivId);
  }
}
