import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { HealthModule } from './health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OperativesModule } from './modules/operatives/operatives.module.js';

@Module({
  imports: [HealthModule, DatabaseModule, AuthModule, OperativesModule],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: false },
          validationError: { target: false, value: false },
          disableErrorMessages: true,
        }),
    },
  ],
})
export class AppModule {}
