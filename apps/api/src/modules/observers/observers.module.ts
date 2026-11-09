import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ObserversController } from './observers.controller.js';
import { ObserversService } from './observers.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ObserversController],
  providers: [ObserversService],
})
export class ObserversModule {}
