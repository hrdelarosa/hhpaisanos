import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
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
