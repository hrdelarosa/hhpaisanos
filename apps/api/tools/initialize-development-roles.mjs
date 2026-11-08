import 'reflect-metadata';
import { pathToFileURL } from 'node:url';
import { inArray } from 'drizzle-orm';
import { loadDatabaseConfig } from '../dist/database/database.config.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { roles } from '../dist/database/schema/index.js';

const approvedRoles = [
  { codigo: 'ADMIN', nombre: 'Administrator', activo: true },
  { codigo: 'ENLACE', nombre: 'Enlace', activo: true },
  { codigo: 'OBSERVADOR', nombre: 'Observador', activo: true },
];

export async function initializeDevelopmentRoles(db) {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(roles)
      .where(
        inArray(
          roles.codigo,
          approvedRoles.map((role) => role.codigo),
        ),
      )
      .for('update');
    if (existing.some((role) => !role.activo)) {
      throw new Error('An approved role is inactive; resolve it explicitly before initializing');
    }
    const missing = approvedRoles.filter(
      (role) => !existing.some((current) => current.codigo === role.codigo),
    );
    if (missing.length) await tx.insert(roles).values(missing);
    return missing.map((role) => role.codigo);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let database;
  try {
    const config = loadDatabaseConfig();
    if (
      process.argv.length !== 2 ||
      (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') ||
      config.host !== 'localhost' ||
      config.database !== 'hhpaisanos' ||
      config.user !== 'hhpaisanos'
    ) {
      throw new Error('Role initialization is restricted to the local development database');
    }
    database = new DatabaseService(config);
    await database.onModuleInit();
    const created = await initializeDevelopmentRoles(database.db);
    console.log(JSON.stringify({ created }));
  } catch {
    console.error(
      'Development role initialization failed. Check local configuration, migrated schema and active existing roles. No changes committed.',
    );
    process.exitCode = 1;
  } finally {
    try {
      await database?.onModuleDestroy();
    } catch {
      console.error('Database connection cleanup failed.');
      process.exitCode = 1;
    }
  }
}
