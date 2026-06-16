import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';

const WRITE_ROLES = ['OWNER', 'ADMIN'];
const MANAGE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

@Controller('areas')
@UseGuards(JwtAuthGuard)
export class AreasController {
  constructor(private readonly svc: AreasService) {}

  @Get()
  list(@CurrentUser() u: UserSession) {
    return this.svc.list(u.organization_id);
  }

  @Get('users')
  listUsers(@CurrentUser() u: UserSession) {
    return this.svc.listOrgUsers(u.organization_id);
  }

  @Get(':id')
  getOne(@CurrentUser() u: UserSession, @Param('id') id: string) {
    return this.svc.getOne(u.organization_id, id);
  }

  @Post()
  create(@CurrentUser() u: UserSession, @Body() dto: CreateAreaDto) {
    if (!WRITE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.create(u.organization_id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: UserSession, @Param('id') id: string, @Body() dto: UpdateAreaDto) {
    if (!WRITE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.update(u.organization_id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() u: UserSession, @Param('id') id: string) {
    if (!WRITE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.delete(u.organization_id, id);
  }

  @Post(':id/teams/:teamId')
  assignTeam(
    @CurrentUser() u: UserSession,
    @Param('id') id: string,
    @Param('teamId') teamId: string,
  ) {
    if (!MANAGE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.assignTeam(u.organization_id, id, teamId);
  }

  @Delete(':id/teams/:teamId')
  removeTeam(
    @CurrentUser() u: UserSession,
    @Param('id') id: string,
    @Param('teamId') teamId: string,
  ) {
    if (!MANAGE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.removeTeam(u.organization_id, id, teamId);
  }
}
