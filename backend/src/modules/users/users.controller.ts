import {
  Controller, Get, Patch, Post, Delete, Body, HttpCode, Res, Query, Param, ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';

@ApiTags('users')
@ApiCookieAuth('access_token')
@Controller('me')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  // ── Profile ────────────────────────────────────────────────

  @Get('profile')
  getProfile(@CurrentUser() user: UserSession) {
    return this.svc.getProfile(user.user_id);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: UserSession, @Body() dto: UpdateProfileDto) {
    return this.svc.updateProfile(user.user_id, dto);
  }

  // ── MFA ───────────────────────────────────────────────────

  @Get('mfa')
  getMfaStatus(@CurrentUser() user: UserSession) {
    return this.svc.getMfaStatus(user.user_id);
  }

  @Post('mfa/setup')
  setupMfa(@CurrentUser() user: UserSession) {
    return this.svc.setupMfa(user.user_id);
  }

  @Post('mfa/enable')
  @HttpCode(200)
  enableMfa(@CurrentUser() user: UserSession, @Body('code') code: string) {
    return this.svc.enableMfa(user.user_id, code);
  }

  @Post('mfa/disable')
  @HttpCode(200)
  disableMfa(@CurrentUser() user: UserSession, @Body('code') code: string) {
    return this.svc.disableMfa(user.user_id, code);
  }

  // ── My Work ───────────────────────────────────────────────

  @Get('my-work')
  getMyWork(
    @CurrentUser() user: UserSession,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.svc.getMyWork(user.user_id, user.organization_id, cycleId);
  }

  // ── First Day Onboarding ──────────────────────────────────

  @Get('first-day')
  getFirstDayContext(@CurrentUser() user: UserSession) {
    return this.svc.getFirstDayContext(user.user_id, user.organization_id);
  }

  @Post('first-day/complete')
  @HttpCode(200)
  completeFirstDay(@CurrentUser() user: UserSession) {
    return this.svc.completeFirstDay(user.user_id);
  }

  @Post('first-day/reset/:targetUserId')
  @HttpCode(200)
  resetFirstDay(@CurrentUser() user: UserSession, @Param('targetUserId') targetUserId: string) {
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      throw new ForbiddenException('Solo administradores y managers pueden reiniciar el tour');
    }
    return this.svc.resetFirstDay(user.organization_id, targetUserId);
  }

  // ── GDPR ──────────────────────────────────────────────────

  @Get('export-data')
  async exportData(@CurrentUser() user: UserSession, @Res() res: Response) {
    const data = await this.svc.exportData(user.user_id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="okr-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.send(JSON.stringify(data, null, 2));
  }

  @Delete('account')
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: UserSession, @Res({ passthrough: true }) res: Response) {
    await this.svc.deleteAccount(user.user_id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }
}
