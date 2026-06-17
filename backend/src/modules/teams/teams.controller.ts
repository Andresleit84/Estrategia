import {
  Controller, Get, Post, Delete, Body, Param, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(@CurrentUser() user: UserSession) {
    return this.teams.list(user.organization_id);
  }

  @Post()
  create(@CurrentUser() user: UserSession, @Body() dto: CreateTeamDto) {
    return this.teams.create(user.organization_id, dto, user.user_id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teams.findOne(id, user.organization_id);
  }

  @Get(':id/members')
  getMembers(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teams.getMembers(id, user.organization_id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.teams.addMember(id, user.organization_id, dto, user.user_id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teams.removeMember(id, userId, user.organization_id);
  }
}
