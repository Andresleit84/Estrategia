import { SetMetadata } from '@nestjs/common';

export interface PermissionMeta { resource: string; action: string }
export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action });
