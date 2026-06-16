import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DbService } from '../../database/db.service';
import { PERMISSION_KEY, PermissionMeta } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionMeta>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user?.user_id) throw new ForbiddenException();

    const [row] = await this.db.query<{ fn_user_has_permission: boolean }>(
      `SELECT fn_user_has_permission($1, $2, $3)`,
      [user.user_id, required.resource, required.action],
    );

    if (!row?.fn_user_has_permission) throw new ForbiddenException();
    return true;
  }
}
