import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { InitiativesService } from './initiatives.service';
import { CreateInitiativeDto } from './dto/create-initiative.dto';
import { UpdateInitiativeDto } from './dto/update-initiative.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { CreateDependencyDto, UpdateDependencyDto } from './dto/create-dependency.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';
import { IsUUID, IsOptional, IsArray } from 'class-validator';

class SetAreasDto {
  @IsOptional() @IsUUID() primary_area_id?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) involved_area_ids?: string[];
}

@Controller('initiatives')
export class InitiativesController {
  constructor(private readonly svc: InitiativesService) {}

  // GET /initiatives
  @Get()
  list(
    @CurrentUser() user: UserSession,
    @Query('cycle_id') cycle_id?: string,
    @Query('team_id') team_id?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.list(user.organization_id, { cycle_id, team_id, status });
  }

  // GET /initiatives/overdue-milestones
  @Get('overdue-milestones')
  overdueMilestones(@CurrentUser() user: UserSession) {
    return this.svc.getOverdueMilestones(user.organization_id);
  }

  // GET /initiatives/objective-links
  @Get('objective-links')
  objectiveLinks(@CurrentUser() user: UserSession) {
    return this.svc.getObjectiveLinks(user.organization_id);
  }

  // GET /initiatives/:id
  @Get(':id')
  getOne(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getOne(user.organization_id, id);
  }

  // POST /initiatives
  @Post()
  create(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateInitiativeDto,
  ) {
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  // PATCH /initiatives/:id
  @Patch(':id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInitiativeDto,
  ) {
    return this.svc.update(user.organization_id, id, dto);
  }

  // DELETE /initiatives/:id
  @Delete(':id')
  delete(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.delete(user.organization_id, id);
  }

  // GET /initiatives/:id/health
  @Get(':id/health')
  health(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getHealth(user.organization_id, id);
  }

  // POST /initiatives/:id/key-results/:krId
  @Post(':id/key-results/:krId')
  linkKr(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('krId', ParseUUIDPipe) krId: string,
  ) {
    return this.svc.linkKr(user.organization_id, id, krId);
  }

  // DELETE /initiatives/:id/key-results/:krId
  @Delete(':id/key-results/:krId')
  unlinkKr(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('krId', ParseUUIDPipe) krId: string,
  ) {
    return this.svc.unlinkKr(user.organization_id, id, krId);
  }

  // GET /initiatives/:id/milestones
  @Get(':id/milestones')
  getMilestones(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getMilestones(user.organization_id, id);
  }

  // POST /initiatives/:id/milestones
  @Post(':id/milestones')
  createMilestone(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.svc.createMilestone(user.organization_id, id, user.user_id, dto);
  }

  // PATCH /initiatives/:id/milestones/:milestoneId
  @Patch(':id/milestones/:milestoneId')
  updateMilestone(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.svc.updateMilestone(user.organization_id, id, milestoneId, dto);
  }

  // POST /initiatives/:id/milestones/:milestoneId/complete
  @Post(':id/milestones/:milestoneId/complete')
  completeMilestone(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    return this.svc.completeMilestone(user.organization_id, id, milestoneId, user.user_id);
  }

  // DELETE /initiatives/:id/milestones/:milestoneId
  @Delete(':id/milestones/:milestoneId')
  deleteMilestone(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    return this.svc.deleteMilestone(user.organization_id, id, milestoneId);
  }

  // PUT /initiatives/:id/areas
  @Patch(':id/areas')
  setAreas(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAreasDto,
  ) {
    return this.svc.setAreas(user.organization_id, id, dto.primary_area_id, dto.involved_area_ids);
  }

  // GET /initiatives/:id/dependencies
  @Get(':id/dependencies')
  getDependencies(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getDependencies(user.organization_id, id);
  }

  // POST /initiatives/:id/dependencies
  @Post(':id/dependencies')
  addDependency(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDependencyDto,
  ) {
    return this.svc.addDependency(user.organization_id, id, dto);
  }

  // PATCH /initiatives/:id/dependencies/:depId
  @Patch(':id/dependencies/:depId')
  updateDependency(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('depId', ParseUUIDPipe) depId: string,
    @Body() dto: UpdateDependencyDto,
  ) {
    return this.svc.updateDependency(user.organization_id, id, depId, dto);
  }

  // DELETE /initiatives/:id/dependencies/:depId
  @Delete(':id/dependencies/:depId')
  deleteDependency(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('depId', ParseUUIDPipe) depId: string,
  ) {
    return this.svc.deleteDependency(user.organization_id, id, depId);
  }
}

// Separate controller for /key-results/:krId/initiatives
@Controller('key-results')
export class KrInitiativesController {
  constructor(private readonly svc: InitiativesService) {}

  @Get(':krId/initiatives')
  getByKr(
    @CurrentUser() user: UserSession,
    @Param('krId', ParseUUIDPipe) krId: string,
  ) {
    return this.svc.getByKr(user.organization_id, krId);
  }
}
