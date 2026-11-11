import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { OperativesController } from './operatives.controller.js';
import { OperativesService } from './operatives.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [OperativesController],
  providers: [OperativesService],
})
export class OperativesModule {}
