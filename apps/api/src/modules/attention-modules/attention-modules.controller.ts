import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { AttentionModulesService } from './attention-modules.service.js';
import { AttentionModuleIdParamDto } from './dto/attention-module-id-param.dto.js';
import { ChangeAttentionModuleStatusDto } from './dto/change-attention-module-status.dto.js';
import { CreateAttentionModuleDto } from './dto/create-attention-module.dto.js';
import { ListAttentionModulesQueryDto } from './dto/list-attention-modules-query.dto.js';
import { UpdateAttentionModuleDto } from './dto/update-attention-module.dto.js';

@Controller('api/attention-modules')
export class AttentionModulesController {
  constructor(private readonly modules: AttentionModulesService) {}

  @Post()
  @RequirePermissions('attention-modules:create')
  create(@Body() input: CreateAttentionModuleDto, @Req() request: AuthRequest) {
    return this.modules.create(input, request.auth!);
  }

  @Get()
  @RequirePermissions('attention-modules:read')
  list(@Query() query: ListAttentionModulesQueryDto) {
    return this.modules.list(query);
  }

  @Get(':id')
  @RequirePermissions('attention-modules:read')
  detail(@Param() params: AttentionModuleIdParamDto) {
    return this.modules.detail(params.id);
  }

  @Patch(':id')
  @HttpCode(204)
  @RequirePermissions('attention-modules:update')
  update(
    @Param() params: AttentionModuleIdParamDto,
    @Body() input: UpdateAttentionModuleDto,
    @Req() request: AuthRequest,
  ) {
    return this.modules.update(params.id, input, request.auth!);
  }

  @Patch(':id/status')
  @HttpCode(204)
  @RequirePermissions('attention-modules:change-status')
  changeStatus(
    @Param() params: AttentionModuleIdParamDto,
    @Body() input: ChangeAttentionModuleStatusDto,
    @Req() request: AuthRequest,
  ) {
    return this.modules.changeStatus(params.id, input, request.auth!);
  }
}
