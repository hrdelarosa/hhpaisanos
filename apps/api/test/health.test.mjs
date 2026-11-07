import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, expect, it } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';

let app;
let baseUrl;

beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, 'localhost');
  baseUrl = await app.getUrl();
}, 30000);

afterAll(async () => {
  await app?.close();
});

it('serves the health endpoint over HTTP', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(await response.json()).toEqual({ status: 'ok' });
});

it('does not expose unimplemented routes', async () => {
  const response = await fetch(`${baseUrl}/api/users`);
  expect(response.status).toBe(404);
});
