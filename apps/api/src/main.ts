import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { installRequestTimestamp } from './request-timestamp.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  installRequestTimestamp(app);
  app.enableShutdownHooks();
  await app.listen(3000, 'localhost');
}

await bootstrap();
