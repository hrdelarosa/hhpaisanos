import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { AttendanceAdministrationService } from './attendance-administration.service.js';
import {
  AdministrativeAttendancePageDto,
  AdministrativeAttendanceQueryDto,
  AttendanceIdParamDto,
  AttendanceVersionDto,
  CorrectAttendanceDto,
  ManualAttendanceDto,
  ReviewAttendanceDto,
} from './dto/attendance-administration.dto.js';

@Controller('api/attendance')
export class AttendanceAdministrationController {
  constructor(private readonly attendance: AttendanceAdministrationService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:read')
  list(@Query() query: AdministrativeAttendanceQueryDto, @Req() request: AuthRequest) {
    return this.attendance.list(request.auth!, query);
  }

  @Get(':id/history')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:read')
  history(
    @Param() params: AttendanceIdParamDto,
    @Query() query: AdministrativeAttendancePageDto,
    @Req() request: AuthRequest,
  ) {
    return this.attendance.history(request.auth!, params.id, query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:read')
  detail(@Param() params: AttendanceIdParamDto, @Req() request: AuthRequest) {
    return this.attendance.detail(request.auth!, params.id);
  }

  @Post('manual')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:capture-manual')
  manual(@Body() input: ManualAttendanceDto, @Req() request: AuthRequest) {
    return this.attendance.manual(request.auth!, input);
  }

  @Post(':id/review')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:review')
  review(
    @Param() params: AttendanceIdParamDto,
    @Body() input: ReviewAttendanceDto,
    @Req() request: AuthRequest,
  ) {
    return this.attendance.review(request.auth!, params.id, input);
  }

  @Post(':id/corrections')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:correct')
  correct(
    @Param() params: AttendanceIdParamDto,
    @Body() input: CorrectAttendanceDto,
    @Req() request: AuthRequest,
  ) {
    return this.attendance.correct(request.auth!, params.id, input);
  }

  @Post(':id/annul')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:annul')
  annul(
    @Param() params: AttendanceIdParamDto,
    @Body() input: AttendanceVersionDto,
    @Req() request: AuthRequest,
  ) {
    return this.attendance.annul(request.auth!, params.id, input);
  }
}
