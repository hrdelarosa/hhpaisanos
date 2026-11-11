import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CreateOperativeDto } from './dto/create-operative.dto.js';
import { ListOperativesQueryDto } from './dto/list-operatives-query.dto.js';
import { OperativeIdParamDto } from './dto/operative-id-param.dto.js';
import { ActivateOperativeDto } from './dto/activate-operative.dto.js';
import { OperativesService } from './operatives.service.js';

@Controller('api/operatives')
export class OperativesController {
  constructor(private readonly operatives: OperativesService) {}

  @Post()
  @RequirePermissions('operatives:create')
  create(@Body() input: CreateOperativeDto, @Req() request: AuthRequest) {
    return this.operatives.create(input, request.auth!);
  }

  @Get()
  @RequirePermissions('operatives:read')
  list(@Query() query: ListOperativesQueryDto) {
    return this.operatives.list(query);
  }

  @Get(':id')
  @RequirePermissions('operatives:read')
  detail(@Param() params: OperativeIdParamDto) {
    return this.operatives.detail(params.id);
  }

  @Post(':id/activate')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('operatives:activate')
  activate(
    @Param() params: OperativeIdParamDto,
    @Body() input: ActivateOperativeDto,
    @Req() request: AuthRequest,
  ) {
    return this.operatives.activate(params.id, input, request.auth!);
  }
}
