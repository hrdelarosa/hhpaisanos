import { defineConfig } from 'drizzle-kit';
import { loadDatabaseConfig } from './src/database/database.config.js';

const config = loadDatabaseConfig();

export default defineConfig({
  dialect: 'mysql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
  },
  strict: true,
});
