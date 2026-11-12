import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AttendancePersistence } from './attendance.persistence.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [AttendancePersistence],
  exports: [AttendancePersistence],
})
export class AttendanceModule {}
