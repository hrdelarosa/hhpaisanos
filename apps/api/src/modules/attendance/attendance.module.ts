import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AttendancePersistence } from './attendance.persistence.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AttendanceController],
  providers: [AttendancePersistence, AttendanceService],
  exports: [AttendancePersistence],
})
export class AttendanceModule {}
