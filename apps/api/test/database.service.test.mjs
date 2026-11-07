import 'reflect-metadata';
import { beforeEach, expect, it, vi } from 'vite-plus/test';

const { createPool, pool, rawPool } = vi.hoisted(() => {
  const pool = { query: vi.fn(), end: vi.fn() };
  const rawPool = { promise: () => pool, on: vi.fn() };
  return { createPool: vi.fn(() => rawPool), pool, rawPool };
});
vi.mock('mysql2', () => ({ createPool }));

import { DatabaseService } from '../dist/database/database.service.js';

const config = {
  host: 'localhost',
  port: 3306,
  database: 'synthetic',
  user: 'synthetic',
  password: 'secret',
  connectionLimit: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  pool.query.mockResolvedValue([[], []]);
  pool.end.mockResolvedValue();
});

it('initializes, configures UTC on every new connection and closes once', async () => {
  const service = new DatabaseService(config);
  expect(() => service.db).toThrow('not initialized');
  await service.onModuleInit();
  expect(createPool).toHaveBeenCalledWith(
    expect.objectContaining({ timezone: 'Z', dateStrings: true }),
  );
  const connection = { query: vi.fn(), destroy: vi.fn() };
  rawPool.on.mock.calls[0][1](connection);
  expect(connection.query).toHaveBeenCalledWith("SET time_zone = '+00:00'", expect.any(Function));
  connection.query.mock.calls[0][1](new Error('session failed'));
  expect(connection.destroy).toHaveBeenCalledOnce();
  expect(service.db).toBeDefined();
  await service.onModuleDestroy();
  await service.onModuleDestroy();
  expect(pool.end).toHaveBeenCalledOnce();
  expect(() => service.db).toThrow('not initialized');
});

it('sanitizes initialization errors and closes the failed pool', async () => {
  pool.query.mockRejectedValue(new Error('secret connection string'));
  const service = new DatabaseService(config);
  await expect(service.onModuleInit()).rejects.toThrow('Database initialization failed');
  expect(pool.end).toHaveBeenCalledOnce();
  expect(() => service.db).toThrow('not initialized');
});

it('preserves the sanitized initialization failure when cleanup also fails', async () => {
  pool.query.mockRejectedValueOnce(new Error('secret initialization details'));
  pool.end.mockRejectedValueOnce(new Error('secret cleanup details'));
  const service = new DatabaseService(config);

  const failure = await service.onModuleInit().catch((error) => error);
  expect(failure).toBeInstanceOf(Error);
  expect(failure.message).toBe(
    'Database initialization failed; verify configuration and MySQL availability',
  );
  expect(failure.cause).toBeUndefined();
  expect(pool.end).toHaveBeenCalledOnce();
  expect(() => service.db).toThrow('not initialized');
  await service.onModuleDestroy();
  expect(pool.end).toHaveBeenCalledOnce();
});

it('handles pool creation failures without leaking credentials', async () => {
  createPool.mockImplementationOnce(() => {
    throw new Error('secret');
  });
  await expect(new DatabaseService(config).onModuleInit()).rejects.toThrow(
    'Database initialization failed',
  );
  expect(pool.end).not.toHaveBeenCalled();
});

it('sanitizes cleanup errors and clears references', async () => {
  const service = new DatabaseService(config);
  await service.onModuleInit();
  pool.end.mockRejectedValueOnce(new Error('secret'));
  await expect(service.onModuleDestroy()).rejects.toThrow('Database connection cleanup failed');
  expect(() => service.db).toThrow('not initialized');
});
