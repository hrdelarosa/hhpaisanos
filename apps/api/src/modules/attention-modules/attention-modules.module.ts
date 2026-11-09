import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AttentionModulesController } from './attention-modules.controller.js';
import { AttentionModulesService } from './attention-modules.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AttentionModulesController],
  providers: [AttentionModulesService],
})
export class AttentionModulesModule {}
