import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserSession } from '../../modules/auth/types/auth.types';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as UserSession;
    if (!user?.is_platform_admin) {
      throw new ForbiddenException('Acceso exclusivo para administrador de plataforma');
    }
    return true;
  }
}
