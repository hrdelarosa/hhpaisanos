import { Module } from '@nestjs/common';
import { DATABASE_CONFIG, loadDatabaseConfig } from './database.config.js';
import { DatabaseService } from './database.service.js';

@Module({
  providers: [{ provide: DATABASE_CONFIG, useFactory: loadDatabaseConfig }, DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
