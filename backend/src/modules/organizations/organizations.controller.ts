import { Controller, Get, Patch, Post, Delete, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { UserSession } from '../auth/types/auth.types';
import { OrganizationsService } from './organizations.service';
import { UpdateOrgDto } from './dto/update-org.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get('me')
  getMe(@CurrentUser() user: UserSession) {
    return this.orgs.findOne(user.organization_id);
  }

  @Patch('me')
  @RequirePermission('organizations.settings', 'UPDATE')
  updateMe(@CurrentUser() user: UserSession, @Body() dto: UpdateOrgDto) {
    return this.orgs.update(user.organization_id, dto);
  }

  @Get('me/members')
  getMembers(@CurrentUser() user: UserSession) {
    return this.orgs.getMembers(user.organization_id);
  }

  @Get('me/team-tree')
  getTeamTree(@CurrentUser() user: UserSession) {
    return this.orgs.getTeamTree(user.organization_id);
  }

  @Get('me/invitations')
  getInvitations(@CurrentUser() user: UserSession) {
    return this.orgs.getInvitations(user.organization_id);
  }

  @Post('me/invitations')
  invite(@CurrentUser() user: UserSession, @Body() body: { email: string; role?: string }) {
    const role = body.role ?? 'MEMBER';
    return this.orgs.inviteMember(user.organization_id, user.user_id, body.email, role);
  }

  @Post('me/invitations/:id/resend')
  resendInvitation(@CurrentUser() user: UserSession, @Param('id') id: string) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.orgs.resendInvitation(user.organization_id, id, user.user_id);
  }

  @Patch('me/members/:userId/role')
  updateMemberRole(
    @CurrentUser() user: UserSession,
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.orgs.updateMemberRole(user.user_id, userId, body.role);
  }

  @Post('me/members/:userId/reset-password')
  resetMemberPassword(@CurrentUser() user: UserSession, @Param('userId') userId: string) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.orgs.resetMemberPassword(user.user_id, userId);
  }

  @Post('me/members/:userId/send-reset-email')
  sendResetEmail(@CurrentUser() user: UserSession, @Param('userId') userId: string) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.orgs.sendResetEmail(user.organization_id, userId);
  }

  @Delete('me/members/:userId')
  removeMember(@CurrentUser() user: UserSession, @Param('userId') userId: string) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.orgs.removeMember(user.user_id, userId);
  }

  @Get('me/parameters')
  getParameters(@CurrentUser() user: UserSession) {
    return this.orgs.getParameters(user.organization_id);
  }

  @Patch('me/parameters')
  updateParameters(@CurrentUser() user: UserSession, @Body() body: Record<string, unknown>) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.orgs.updateParameters(user.organization_id, body);
  }
}
