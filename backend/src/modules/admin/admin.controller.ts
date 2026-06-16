import { Controller, Get, Delete, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';
import { AdminService, PlanLevel } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('organizations')
  listOrgs() {
    return this.admin.listOrganizations();
  }

  @Patch('organizations/:id/plan')
  updatePlan(
    @Param('id') id: string,
    @Body() body: { plan: PlanLevel; period_start?: string; period_end?: string; notes?: string },
    @CurrentUser() user: UserSession,
  ) {
    return this.admin.updateOrgPlan(id, body.plan, body.period_start ?? null, body.period_end ?? null, body.notes, user.user_id);
  }

  @Delete('organizations/:id')
  deleteOrg(@Param('id') id: string, @CurrentUser() user: UserSession) {
    return this.admin.deleteOrganization(id, user.user_id, user.organization_id);
  }
}
