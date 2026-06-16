import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { GovernanceService } from './governance.service';
import { CreateBodyDto } from './dto/create-body.dto';
import { UpdateBodyDto } from './dto/update-body.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';

const WRITE_ROLES = ['OWNER', 'ADMIN'];

@Controller('governance')
@UseGuards(JwtAuthGuard)
export class GovernanceController {
  constructor(private readonly svc: GovernanceService) {}

  @Get()
  list(@CurrentUser() u: UserSession) {
    return this.svc.listBodies(u.organization_id);
  }

  @Post()
  create(@CurrentUser() u: UserSession, @Body() dto: CreateBodyDto) {
    if (!WRITE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.createBody(u.organization_id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: UserSession, @Param('id') id: string, @Body() dto: UpdateBodyDto) {
    if (!WRITE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.updateBody(u.organization_id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() u: UserSession, @Param('id') id: string) {
    if (!WRITE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.deleteBody(u.organization_id, id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() u: UserSession,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    if (!WRITE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.addMember(u.organization_id, id, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() u: UserSession,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    if (!WRITE_ROLES.includes(u.role)) throw new ForbiddenException();
    return this.svc.removeMember(u.organization_id, id, userId);
  }
}
