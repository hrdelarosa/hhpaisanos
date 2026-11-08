import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CredentialRateGuard } from '../auth/guards/credential-rate.guard.js';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UserIdParamDto } from './dto/user-id-param.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ChangeUserStatusDto } from './dto/change-user-status.dto.js';
import { AssignUserRoleDto } from './dto/assign-user-role.dto.js';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';

@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @RequirePermissions('users:create')
  @UseGuards(CredentialRateGuard)
  @Header('Cache-Control', 'no-store')
  create(@Req() request: AuthRequest, @Body() input: CreateUserDto) {
    return this.users.create(request.auth!, input);
  }

  @Get()
  @RequirePermissions('users:read')
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest, @Query() query: ListUsersQueryDto) {
    return this.users.list(request.auth!, query);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  @Header('Cache-Control', 'no-store')
  detail(@Req() request: AuthRequest, @Param() params: UserIdParamDto) {
    return this.users.detail(request.auth!, params.id);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  @HttpCode(204)
  update(
    @Req() request: AuthRequest,
    @Param() params: UserIdParamDto,
    @Body() input: UpdateUserDto,
  ) {
    return this.users.update(request.auth!, params.id, input);
  }

  @Patch(':id/status')
  @RequirePermissions('users:change-status')
  @HttpCode(204)
  status(
    @Req() request: AuthRequest,
    @Param() params: UserIdParamDto,
    @Body() input: ChangeUserStatusDto,
  ) {
    return this.users.changeStatus(request.auth!, params.id, input);
  }

  @Put(':id/role')
  @RequirePermissions('users:assign-role')
  @HttpCode(204)
  role(
    @Req() request: AuthRequest,
    @Param() params: UserIdParamDto,
    @Body() input: AssignUserRoleDto,
  ) {
    return this.users.assignRole(request.auth!, params.id, input);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users:reset-password')
  @UseGuards(CredentialRateGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  reset(
    @Req() request: AuthRequest,
    @Param() params: UserIdParamDto,
    @Body() input: ResetUserPasswordDto,
  ) {
    return this.users.resetPassword(request.auth!, params.id, input);
  }
}
