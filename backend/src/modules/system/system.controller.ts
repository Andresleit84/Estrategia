import { Controller, Get, Post, ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';
import { SystemService } from './system.service';

@Controller('system')
export class SystemController {
  constructor(private readonly svc: SystemService) {}

  @Get('status')
  async getStatus(@CurrentUser() user: UserSession) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.svc.getStatus();
  }

  @Post('run-tests')
  async runTests(@CurrentUser() user: UserSession) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw new ForbiddenException();
    return this.svc.runTests();
  }

  @Get('setup-status')
  getSetupStatus(@CurrentUser() user: UserSession) {
    return this.svc.getSetupStatus(user.organization_id, user.user_id);
  }
}
