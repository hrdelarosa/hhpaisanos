import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AttendancePersistence } from './attendance.persistence.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceAdministrationController } from './attendance-administration.controller.js';
import { AttendanceAdministrationService } from './attendance-administration.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AttendanceController, AttendanceAdministrationController],
  providers: [AttendancePersistence, AttendanceService, AttendanceAdministrationService],
  exports: [AttendancePersistence],
})
export class AttendanceModule {}
