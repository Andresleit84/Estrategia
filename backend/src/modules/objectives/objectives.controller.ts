import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ObjectivesService } from './objectives.service';
import { CreateObjectiveDto } from './dto/create-objective.dto';
import { UpdateObjectiveDto } from './dto/update-objective.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller('objectives')
export class ObjectivesController {
  constructor(private readonly svc: ObjectivesService) {}

  @Get()
  findAll(
    @CurrentUser() user: UserSession,
    @Query('cycle_id') cycle_id?: string,
    @Query('level') level?: string,
    @Query('status') status?: string,
    @Query('owner_id') owner_id?: string,
    @Query('team_id') team_id?: string,
  ) {
    return this.svc.findAll(user.organization_id, cycle_id, level, status, owner_id, team_id);
  }

  @Get('alignment')
  getAlignmentMap(
    @CurrentUser() user: UserSession,
    @Query('cycle_id', ParseUUIDPipe) cycle_id: string,
  ) {
    return this.svc.getAlignmentMap(user.organization_id, cycle_id);
  }

  @Get('tree')
  getTree(
    @CurrentUser() user: UserSession,
    @Query('cycle_id') cycleId: string,
  ) {
    return this.svc.getTree(user.organization_id, cycleId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOne(user.organization_id, id);
  }

  @Get(':id/key-results')
  findKeyResults(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findKeyResults(user.organization_id, id);
  }

  @Post()
  create(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateObjectiveDto,
  ) {
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateObjectiveDto,
  ) {
    return this.svc.update(user.organization_id, id, dto);
  }

  @Delete(':id')
  cancel(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.cancel(user.organization_id, id, user.user_id);
  }

  @Get(':id/alignments')
  getAlignments(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getAlignments(user.organization_id, id);
  }

  @Post(':id/alignments/:targetId')
  addAlignment(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.svc.addAlignment(user.organization_id, id, targetId);
  }

  @Delete(':id/alignments/:targetId')
  removeAlignment(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.svc.removeAlignment(user.organization_id, id, targetId);
  }
}
