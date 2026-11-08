import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { OperativesController } from './operatives.controller.js';
import { OperativesService } from './operatives.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OperativesController],
  providers: [OperativesService],
})
export class OperativesModule {}
