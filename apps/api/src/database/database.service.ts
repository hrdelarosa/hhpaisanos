import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2';
import type { Pool } from 'mysql2/promise';
import { DATABASE_CONFIG, type DatabaseConfig } from './database.config.js';
import * as schema from './schema/index.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool?: Pool;
  private client?: MySql2Database<typeof schema>;

  constructor(@Inject(DATABASE_CONFIG) private readonly config: DatabaseConfig) {}

  get db(): MySql2Database<typeof schema> {
    if (!this.client) throw new Error('Database is not initialized');
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    try {
      const pool = createPool({
        ...this.config,
        timezone: 'Z',
        dateStrings: true,
        connectTimeout: 10000,
        multipleStatements: false,
      });
      // mysql2 queues this before queries on every new pooled connection.
      this.pool = pool.promise();
      pool.on('connection', (connection) => {
        connection.query("SET time_zone = '+00:00'", (error) => {
          if (error) connection.destroy();
        });
      });
      await this.pool.query('SELECT 1');
      this.client = drizzle(this.pool, { schema, mode: 'default' });
    } catch {
      try {
        await this.onModuleDestroy();
      } catch {
        // A secondary cleanup failure must not mask the sanitized initialization error.
      }
      throw new Error(
        'Database initialization failed; verify configuration and MySQL availability',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    const pool = this.pool;
    this.pool = undefined;
    this.client = undefined;
    try {
      await pool?.end();
    } catch {
      throw new Error('Database connection cleanup failed');
    }
  }
}
