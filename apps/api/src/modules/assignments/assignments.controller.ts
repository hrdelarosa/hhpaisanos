import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { AssignmentsService } from './assignments.service.js';
import { AssignmentIdParamDto } from './dto/assignment-id-param.dto.js';
import { CancelAssignmentDto } from './dto/cancel-assignment.dto.js';
import { ChangeAssignmentDto } from './dto/change-assignment.dto.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto.js';
import { TerminateAssignmentDto } from './dto/terminate-assignment.dto.js';

@Controller('api/assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Post()
  @RequirePermissions('assignments:create')
  @Header('Cache-Control', 'no-store')
  create(@Body() input: CreateAssignmentDto, @Req() request: AuthRequest) {
    return this.assignments.create(input, request.auth!);
  }

  @Get()
  @RequirePermissions('assignments:read')
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListAssignmentsQueryDto) {
    return this.assignments.list(query);
  }

  @Get(':id')
  @RequirePermissions('assignments:read')
  @Header('Cache-Control', 'no-store')
  detail(@Param() params: AssignmentIdParamDto) {
    return this.assignments.detail(params.id);
  }

  @Post(':id/change')
  @RequirePermissions('assignments:update')
  @Header('Cache-Control', 'no-store')
  async change(
    @Param() params: AssignmentIdParamDto,
    @Body() input: ChangeAssignmentDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const created = await this.assignments.modify(params.id, input, 'change', request.auth!);
    if (!created) response.status(204);
    return created;
  }

  @Post(':id/terminate')
  @HttpCode(204)
  @RequirePermissions('assignments:update')
  terminate(
    @Param() params: AssignmentIdParamDto,
    @Body() input: TerminateAssignmentDto,
    @Req() request: AuthRequest,
  ) {
    return this.assignments.modify(params.id, input, 'terminate', request.auth!);
  }

  @Post(':id/cancel')
  @HttpCode(204)
  @RequirePermissions('assignments:cancel')
  cancel(
    @Param() params: AssignmentIdParamDto,
    @Body() input: CancelAssignmentDto,
    @Req() request: AuthRequest,
  ) {
    return this.assignments.modify(params.id, input, 'cancel', request.auth!);
  }
}
