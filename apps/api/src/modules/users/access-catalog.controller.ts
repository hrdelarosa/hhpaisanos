import { Controller, Get, Header, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { UsersService } from './users.service.js';

@Controller('api')
export class AccessCatalogController {
  constructor(private readonly users: UsersService) {}

  @Get('roles')
  @RequirePermissions('roles:read')
  @Header('Cache-Control', 'no-store')
  roles(@Req() request: AuthRequest) {
    return this.users.roles(request.auth!);
  }

  @Get('permissions')
  @RequirePermissions('permissions:read')
  @Header('Cache-Control', 'no-store')
  permissions(@Req() request: AuthRequest) {
    return this.users.permissions(request.auth!);
  }
}
