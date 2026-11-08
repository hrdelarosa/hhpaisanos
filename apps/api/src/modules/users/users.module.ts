import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersController } from './users.controller.js';
import { AccessCatalogController } from './access-catalog.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [UsersController, AccessCatalogController],
  providers: [UsersService],
})
export class UsersModule {}
