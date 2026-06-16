import { SetMetadata } from '@nestjs/common';

export type PlanLevel = 'FREE' | 'PRO' | 'ENTERPRISE';

export const PLAN_KEY      = 'requiredPlan';
export const PLAN_FREE_KEY = 'planFree';

export const RequiresPlan = (plan: PlanLevel) => SetMetadata(PLAN_KEY, plan);
export const PlanFree     = ()                 => SetMetadata(PLAN_FREE_KEY, true);
