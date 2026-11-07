import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({ imports: [HealthModule, DatabaseModule] })
export class AppModule {}
