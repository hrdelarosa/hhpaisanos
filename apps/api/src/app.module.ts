import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { HealthModule } from './health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OperativesModule } from './modules/operatives/operatives.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AttentionModulesModule } from './modules/attention-modules/attention-modules.module.js';
import { ObserversModule } from './modules/observers/observers.module.js';

@Module({
  imports: [
    HealthModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    OperativesModule,
    AttentionModulesModule,
    ObserversModule,
  ],
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
