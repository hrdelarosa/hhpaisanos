import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS = Symbol('auth:permissions');
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS, permissions);
