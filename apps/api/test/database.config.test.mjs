import { describe, expect, it } from 'vite-plus/test';
import { validateDatabaseConfig } from '../dist/database/database.config.js';

const env = {
  DB_HOST: 'localhost',
  DB_NAME: 'synthetic',
  DB_USER: 'synthetic',
  DB_PASSWORD: 'synthetic-secret',
};

describe('database configuration', () => {
  it('validates required configuration with bounded defaults', () => {
    expect(validateDatabaseConfig(env)).toEqual({
      host: 'localhost',
      database: 'synthetic',
      user: 'synthetic',
      password: 'synthetic-secret',
      port: 3306,
      connectionLimit: 5,
    });
    expect(validateDatabaseConfig({ ...env, DB_PORT: '3307', DB_POOL_SIZE: '2' }).port).toBe(3307);
  });

  it.each(['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'])(
    'rejects missing %s without revealing values',
    (key) => {
      expect(() => validateDatabaseConfig({ ...env, [key]: ' ' })).toThrow(key);
      expect(() => validateDatabaseConfig({ ...env, [key]: undefined })).not.toThrow(
        'synthetic-secret',
      );
    },
  );

  it.each(['', '0', '-1', '1.5', 'NaN', '65536', '1e2', ' 3306'])(
    'rejects invalid ports: %s',
    (port) => {
      expect(() => validateDatabaseConfig({ ...env, DB_PORT: port })).toThrow('DB_PORT');
    },
  );

  it.each(['', '0', '101', '-1', '2.5'])('rejects invalid pool limits: %s', (size) => {
    expect(() => validateDatabaseConfig({ ...env, DB_POOL_SIZE: size })).toThrow('DB_POOL_SIZE');
  });
});
