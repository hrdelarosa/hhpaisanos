import 'reflect-metadata';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { loadDatabaseConfig } from '../dist/database/database.config.js';
import { DatabaseService } from '../dist/database/database.service.js';

const command = process.argv[2];
if (!['check', 'migrate'].includes(command)) {
  throw new Error('Expected check or migrate');
}

let service;
try {
  service = new DatabaseService(loadDatabaseConfig());
  await service.onModuleInit();
  if (command === 'migrate') {
    await migrate(service.db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed; previously tracked migrations were not reapplied.');
  } else {
    console.log('MySQL connection verified.');
  }
} catch (error) {
  // Driver/Drizzle errors may contain connection details or SQL values.
  const code = (error.cause ?? error).code;
  const diagnostic = typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? ` (${code})` : '';
  console.error(
    `Database ${command} failed${diagnostic}. Check configuration, connectivity and migration state; MySQL DDL may be partially applied.`,
  );
  process.exitCode = 1;
} finally {
  try {
    await service?.onModuleDestroy();
  } catch {
    console.error('Database connection cleanup failed.');
    process.exitCode = 1;
  }
}
