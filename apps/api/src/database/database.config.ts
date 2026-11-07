import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const DATABASE_CONFIG = Symbol('DATABASE_CONFIG');

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  connectionLimit: number;
}

export function validateDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value?.trim()) throw new Error(`Missing database configuration: ${name}`);
    return value;
  };
  const integer = (name: string, fallback: string, max: number): number => {
    const value = env[name] ?? fallback;
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
      throw new Error(`Invalid database configuration: ${name}`);
    }
    return Number(value);
  };
  return {
    host: required('DB_HOST'),
    port: integer('DB_PORT', '3306', 65535),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    connectionLimit: integer('DB_POOL_SIZE', '5', 100),
  };
}

export function loadDatabaseConfig(): DatabaseConfig {
  // All API scripts run with apps/api as their working directory.
  const envPath = resolve('../../.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  return validateDatabaseConfig(process.env);
}
