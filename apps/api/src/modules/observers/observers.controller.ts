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
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CreateObserverDto } from './dto/create-observer.dto.js';
import { UpdateObserverDto } from './dto/update-observer.dto.js';
import { ChangeObserverStatusDto } from './dto/change-observer-status.dto.js';
import { ListObserversQueryDto } from './dto/list-observers-query.dto.js';
import { ObserverIdParamDto } from './dto/observer-id-param.dto.js';
import { ObserversService } from './observers.service.js';
import { LinkObserverAccountDto } from './dto/link-observer-account.dto.js';
import { LinkableAccountQueryDto } from './dto/linkable-account-query.dto.js';

@Controller('api/observers')
export class ObserversController {
  constructor(private readonly observers: ObserversService) {}

  @Post()
  @RequirePermissions('observers:create')
  @Header('Cache-Control', 'no-store')
  create(@Req() request: AuthRequest, @Body() input: CreateObserverDto) {
    return this.observers.create(request.auth!, input);
  }

  @Get()
  @RequirePermissions('observers:read')
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListObserversQueryDto) {
    return this.observers.list(query);
  }

  @Get('linkable-account')
  @RequirePermissions('observers:link-account')
  @Header('Cache-Control', 'no-store')
  linkableAccount(@Query() query: LinkableAccountQueryDto) {
    return this.observers.linkableAccount(query.username);
  }

  @Put(':id/account')
  @RequirePermissions('observers:link-account')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  linkAccount(
    @Req() request: AuthRequest,
    @Param() params: ObserverIdParamDto,
    @Body() input: LinkObserverAccountDto,
  ) {
    return this.observers.linkAccount(request.auth!, params.id, input);
  }

  @Get(':id')
  @RequirePermissions('observers:read')
  @Header('Cache-Control', 'no-store')
  detail(@Param() params: ObserverIdParamDto) {
    return this.observers.detail(params.id);
  }

  @Patch(':id')
  @RequirePermissions('observers:update')
  @HttpCode(204)
  update(
    @Req() request: AuthRequest,
    @Param() params: ObserverIdParamDto,
    @Body() input: UpdateObserverDto,
  ) {
    return this.observers.update(request.auth!, params.id, input);
  }

  @Patch(':id/status')
  @RequirePermissions('observers:change-status')
  @HttpCode(204)
  status(
    @Req() request: AuthRequest,
    @Param() params: ObserverIdParamDto,
    @Body() input: ChangeObserverStatusDto,
  ) {
    return this.observers.changeStatus(request.auth!, params.id, input);
  }
}
