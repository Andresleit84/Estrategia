import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  ParseUUIDPipe, Query,
} from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CloseSprintDto } from './dto/close-sprint.dto';
import { LinkKrDto } from './dto/link-kr.dto';
import { GenerateSprintsDto } from './dto/generate-sprints.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';

@Controller('sprints')
export class SprintsController {
  constructor(private readonly svc: SprintsService) {}

  @Get()
  list(
    @CurrentUser() user: UserSession,
    @Query('cycle_id') cycle_id?: string,
    @Query('team_id') team_id?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.list(user.organization_id, { cycle_id, team_id, status });
  }

  // Static routes before :id to prevent UUID parse errors
  @Post('generate')
  generate(@CurrentUser() user: UserSession, @Body() dto: GenerateSprintsDto) {
    return this.svc.generate(user.organization_id, user.user_id, dto);
  }

  @Post()
  create(@CurrentUser() user: UserSession, @Body() dto: CreateSprintDto) {
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  // Specific routes before :id to prevent UUID parse errors
  @Get('active')
  getActive(@CurrentUser() user: UserSession, @Query('team_id', ParseUUIDPipe) teamId: string) {
    return this.svc.getActiveForTeam(user.organization_id, teamId);
  }

  @Get(':id')
  getBoard(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getBoard(user.organization_id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSprintDto,
  ) {
    return this.svc.update(user.organization_id, id, dto);
  }

  @Post(':id/activate')
  activate(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.activate(user.organization_id, id, user.user_id);
  }

  @Post(':id/close')
  close(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseSprintDto,
  ) {
    return this.svc.close(user.organization_id, id, user.user_id, dto);
  }

  @Get(':id/okr-impact')
  okrImpact(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getOkrImpact(user.organization_id, id);
  }

  @Post(':id/krs')
  linkKr(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkKrDto,
  ) {
    return this.svc.linkKr(user.organization_id, id, dto);
  }

  @Delete(':id/krs/:krId')
  unlinkKr(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('krId', ParseUUIDPipe) krId: string,
  ) {
    return this.svc.unlinkKr(user.organization_id, id, krId);
  }

  @Delete(':id')
  delete(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.delete(user.organization_id, id);
  }
}

// ── Cycle-scoped sprint endpoints ─────────────────────────────────────────────

@Controller('cycles/:cycleId/sprints')
export class CycleSprintsController {
  constructor(private readonly svc: SprintsService) {}

  @Get('timeline')
  timeline(
    @CurrentUser() user: UserSession,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Query('team_id') team_id?: string,
  ) {
    return this.svc.getTimeline(user.organization_id, cycleId, { team_id });
  }

  @Get('burnup')
  burnup(
    @CurrentUser() user: UserSession,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Query('team_id', ParseUUIDPipe) teamId: string,
  ) {
    return this.svc.getBurnup(user.organization_id, cycleId, teamId);
  }
}

// ── Team-scoped velocity endpoint ─────────────────────────────────────────────

@Controller('teams/:teamId/velocity')
export class TeamVelocityController {
  constructor(private readonly svc: SprintsService) {}

  @Get()
  velocity(@CurrentUser() user: UserSession, @Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.svc.getVelocity(user.organization_id, teamId);
  }
}
