import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_KEY, PLAN_FREE_KEY, PlanLevel } from '../decorators/require-plan.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

const PLAN_RANK: Record<string, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 };

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isFree = this.reflector.get<boolean>(PLAN_FREE_KEY, context.getHandler());
    if (isFree) return true;

    const required = this.reflector.getAllAndOverride<PlanLevel>(PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user = context.switchToHttp().getRequest().user as UserSession;
    if (!user) throw new ForbiddenException();

    const effective = this.effectivePlan(user);
    if ((PLAN_RANK[effective] ?? 0) < (PLAN_RANK[required] ?? 0)) {
      throw new ForbiddenException(`PLAN_REQUIRED:${required}`);
    }
    return true;
  }

  private effectivePlan(user: UserSession): string {
    if (user.org_plan !== 'FREE') return user.org_plan;
    if (user.org_trial_expires_at && new Date(user.org_trial_expires_at) > new Date()) return 'PRO';
    return 'FREE';
  }
}
