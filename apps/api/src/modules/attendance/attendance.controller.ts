import { Body, Controller, Get, Header, Headers, Post, Query, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { AttendanceService } from './attendance.service.js';
import { CaptureAttendanceDto } from './dto/capture-attendance.dto.js';
import { AttendanceHistoryQueryDto } from './dto/attendance-history-query.dto.js';

@Controller('api/attendance/me')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('check-in')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:capture-own')
  checkIn(
    @Body() input: CaptureAttendanceDto,
    @Headers('idempotency-key') key: string,
    @Req() request: AuthRequest,
  ) {
    return this.attendance.capture(request.auth!, key, input, 'entrada', request.receivedAt!);
  }

  @Post('check-out')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:capture-own')
  checkOut(
    @Body() input: CaptureAttendanceDto,
    @Headers('idempotency-key') key: string,
    @Req() request: AuthRequest,
  ) {
    return this.attendance.capture(request.auth!, key, input, 'salida', request.receivedAt!);
  }

  @Get('today')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:read-own')
  today(@Req() request: AuthRequest) {
    return this.attendance.today(request.auth!, request.receivedAt!);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('attendance:read-own')
  history(@Query() query: AttendanceHistoryQueryDto, @Req() request: AuthRequest) {
    return this.attendance.history(request.auth!, query);
  }
}
