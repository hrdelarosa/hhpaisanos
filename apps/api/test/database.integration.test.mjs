import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { NestFactory } from '@nestjs/core';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createConnection } from 'mysql2/promise';
import { v7 } from 'uuid';
import { afterAll, beforeAll, expect, it } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { loadDatabaseConfig } from '../dist/database/database.config.js';
import { DatabaseService } from '../dist/database/database.service.js';
import * as tables from '../dist/database/schema/index.js';

const suffix = randomBytes(8).toString('hex');
const database = `hhpaisanos_test_${suffix}`;
const runtimeUser = `hhp_test_${suffix}`;
const runtimePassword = randomBytes(24).toString('hex');
let created = false;
let runtimeCreated = false;
let app;
let service;
let config;
let originalDatabase;
const ids = { role: v7(), user: v7(), observer: v7(), operative: v7(), module: v7() };
const mark = '2026-11-05 12:34:56.123456';

function rootSql(statement) {
  // SQL is sent on stdin; root credentials stay inside the Compose container.
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'mysql',
      'sh',
      '-c',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root --batch --skip-column-names',
    ],
    { cwd: '../..', input: statement, encoding: 'utf8', timeout: 30000 },
  );
  if (result.status !== 0)
    throw new Error('Isolated database setup/cleanup failed; check the Compose MySQL service');
  return result.stdout.trim();
}

function migration(env = {}) {
  return spawnSync(process.execPath, ['tools/database.mjs', 'migrate'], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30000,
  });
}

async function rejectsCode(operation, code) {
  try {
    await operation;
  } catch (error) {
    expect((error.cause ?? error).code).toBe(code);
    return;
  }
  expect.fail(`Expected MySQL ${code}`);
}

beforeAll(async () => {
  config = loadDatabaseConfig();
  if (
    config.host !== 'localhost' ||
    config.port !== 3306 ||
    config.database !== 'hhpaisanos' ||
    config.user !== 'hhpaisanos'
  ) {
    throw new Error('Integration tests require the documented localhost Compose configuration');
  }
  if (!rootSql('SELECT VERSION();').startsWith('8.4.'))
    throw new Error('Integration tests require MySQL 8.4');
  rootSql(`CREATE DATABASE \`${database}\`;`);
  created = true;
  rootSql(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO 'hhpaisanos'@'%';`);
  originalDatabase = process.env.DB_NAME;
  process.env.DB_NAME = database;
  const result = migration();
  if (result.status !== 0) throw new Error('Initial isolated migration failed');
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, 'localhost');
  service = app.get(DatabaseService);
}, 60000);

afterAll(async () => {
  try {
    await app?.close();
  } finally {
    if (originalDatabase === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = originalDatabase;
    if (runtimeCreated) rootSql(`DROP USER '${runtimeUser}'@'%';`);
    if (created) {
      rootSql(
        `DROP DATABASE \`${database}\`; REVOKE ALL PRIVILEGES ON \`${database}\`.* FROM 'hhpaisanos'@'%';`,
      );
    }
  }
}, 30000);

it('creates exactly the 11 approved tables and tracks the migration without reapplying it', async () => {
  const [rows] = await service.db.execute(
    sql`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ${database}`,
  );
  expect(
    rows
      .map((r) => r.name)
      .filter((name) => name !== '__drizzle_migrations')
      .sort(),
  ).toEqual([
    'asignaciones',
    'auditoria',
    'conceptos_atencion',
    'modulos_atencion',
    'observadores',
    'operativos',
    'permisos',
    'rol_permisos',
    'roles',
    'sesiones',
    'usuarios',
  ]);
  const [before] = await service.db.execute(sql`SELECT * FROM __drizzle_migrations`);
  expect(before).toHaveLength(1);
  expect(migration().status).toBe(0);
  const [after] = await service.db.execute(sql`SELECT * FROM __drizzle_migrations`);
  expect(after).toEqual(before);
});

it('reports migration failures without leaking credentials', () => {
  const result = migration({ DB_PASSWORD: 'synthetic-invalid-password' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Database migrate failed');
  expect(result.stderr).not.toContain('synthetic-invalid-password');
  expect(result.stderr).not.toContain(config.password);
});

it('does not track failed migrations or assume partially applied DDL was rolled back', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'hhpaisanos-migrations-'));
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
  const initial = journal.entries[0];
  mkdirSync(join(folder, 'meta'));
  copyFileSync(`drizzle/${initial.tag}.sql`, join(folder, `${initial.tag}.sql`));
  journal.entries.push({
    ...initial,
    idx: 1,
    when: initial.when + 1,
    tag: '0001_synthetic_failure',
  });
  writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify(journal));
  writeFileSync(
    join(folder, '0001_synthetic_failure.sql'),
    'CREATE TABLE synthetic_partial_ddl (id INT PRIMARY KEY);\n--> statement-breakpoint\nTHIS IS NOT VALID SQL;',
  );
  try {
    await rejectsCode(migrate(service.db, { migrationsFolder: folder }), 'ER_PARSE_ERROR');
    const [tracking] = await service.db.execute(sql`SELECT * FROM __drizzle_migrations`);
    expect(tracking).toHaveLength(1);
    const [partial] = await service.db.execute(sql`SHOW TABLES LIKE 'synthetic_partial_ddl'`);
    expect(partial).toHaveLength(1);
  } finally {
    await service.db.execute(sql`DROP TABLE IF EXISTS synthetic_partial_ddl`);
    unlinkSync(join(folder, `${initial.tag}.sql`));
    unlinkSync(join(folder, '0001_synthetic_failure.sql'));
    unlinkSync(join(folder, 'meta', '_journal.json'));
    rmdirSync(join(folder, 'meta'));
    rmdirSync(folder);
  }
});

it('enforces primary keys, unique values, composite keys and foreign keys', async () => {
  const role = { id: ids.role, codigo: 'SYNTHETIC', nombre: 'Synthetic test role', activo: true };
  await service.db.insert(tables.roles).values(role);
  await rejectsCode(service.db.insert(tables.roles).values(role), 'ER_DUP_ENTRY');
  await rejectsCode(service.db.insert(tables.roles).values({ ...role, id: v7() }), 'ER_DUP_ENTRY');
  const permission = v7();
  await service.db.insert(tables.permisos).values({ id: permission, codigo: 'synthetic:test' });
  await service.db.insert(tables.rolPermisos).values({ rolId: ids.role, permisoId: permission });
  await rejectsCode(
    service.db.insert(tables.rolPermisos).values({ rolId: ids.role, permisoId: permission }),
    'ER_DUP_ENTRY',
  );
  await rejectsCode(
    service.db.insert(tables.rolPermisos).values({ rolId: v7(), permisoId: permission }),
    'ER_NO_REFERENCED_ROW_2',
  );
  await service.db.insert(tables.usuarios).values({
    id: ids.user,
    rolId: ids.role,
    nombreUsuario: 'synthetic',
    nombreCompleto: 'Synthetic user',
    passwordHash: 'not-a-real-hash',
    activo: true,
    debeCambiarPassword: true,
    intentosFallidos: 0,
  });
  await rejectsCode(
    service.db.delete(tables.roles).where(eq(tables.roles.id, ids.role)),
    'ER_ROW_IS_REFERENCED_2',
  );
  await service.db.insert(tables.observadores).values({
    id: ids.observer,
    nombres: 'Synthetic',
    apellidos: 'Observer',
    usuarioId: ids.user,
    activo: true,
  });
  await rejectsCode(
    service.db
      .insert(tables.observadores)
      .values({ nombres: 'Other', apellidos: 'Observer', usuarioId: ids.user, activo: true }),
    'ER_DUP_ENTRY',
  );
  // Multiple accountless observers are permitted by the nullable unique key.
  await service.db.insert(tables.observadores).values([
    { nombres: 'Accountless', apellidos: 'One', activo: true },
    { nombres: 'Accountless', apellidos: 'Two', activo: true },
  ]);
});

it('enforces CHECK constraints, nullable coordinates and unsigned settings', async () => {
  const operative = {
    id: ids.operative,
    nombre: 'Synthetic operative',
    fechaInicio: '2026-11-01',
    fechaFin: '2026-11-30',
    estado: 'borrador',
  };
  await rejectsCode(
    service.db.insert(tables.operativos).values({ ...operative, fechaFin: '2026-10-01' }),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  await rejectsCode(
    service.db.insert(tables.operativos).values({ ...operative, estado: 'invented' }),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  await rejectsCode(
    service.db.insert(tables.operativos).values({ ...operative, toleranciaMinutos: -1 }),
    'ER_WARN_DATA_OUT_OF_RANGE',
  );
  await service.db.insert(tables.operativos).values(operative);
  const module = {
    id: ids.module,
    nombre: 'Synthetic module',
    municipio: 'Synthetic municipality',
    activo: true,
  };
  await rejectsCode(
    service.db.insert(tables.modulosAtencion).values({ ...module, latitud: '17.000000' }),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  await rejectsCode(
    service.db
      .insert(tables.modulosAtencion)
      .values({ ...module, latitud: '90.000001', longitud: '0' }),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  await rejectsCode(
    service.db
      .insert(tables.modulosAtencion)
      .values({ ...module, latitud: '0', longitud: '180.000001' }),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  await service.db.insert(tables.modulosAtencion).values(module);
  await rejectsCode(
    service.db.execute(
      sql`UPDATE modulos_atencion SET activo = 2 WHERE id = ${Buffer.from(ids.module.replaceAll('-', ''), 'hex')}`,
    ),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  await service.db.insert(tables.conceptosAtencion).values({
    clave: 'SYNTHETIC',
    nombre: 'Synthetic concept, not official',
    orden: 1,
    requiereEspecificacion: true,
    activo: true,
  });
});

it('retains cancelled assignments while allowing exact active replacements', async () => {
  const assignment = {
    operativoId: ids.operative,
    observadorId: ids.observer,
    moduloId: ids.module,
    fecha: '2026-11-05',
    horaInicio: '08:00:00',
    horaFin: '16:00:00',
    creadoPor: ids.user,
  };
  for (const hours of [
    ['16:00:00', '08:00:00'],
    ['08:00:00', '08:00:00'],
    ['-01:00:00', '08:00:00'],
    ['08:00:00', '24:00:00'],
  ]) {
    await rejectsCode(
      service.db
        .insert(tables.asignaciones)
        .values({ ...assignment, horaInicio: hours[0], horaFin: hours[1] }),
      'ER_CHECK_CONSTRAINT_VIOLATED',
    );
  }
  const first = v7();
  await service.db.insert(tables.asignaciones).values({ ...assignment, id: first });
  await rejectsCode(service.db.insert(tables.asignaciones).values(assignment), 'ER_DUP_ENTRY');
  await service.db
    .update(tables.asignaciones)
    .set({ canceladaEn: mark })
    .where(eq(tables.asignaciones.id, first));
  await service.db.insert(tables.asignaciones).values({ ...assignment, canceladaEn: mark });
  await service.db.insert(tables.asignaciones).values(assignment);
  await rejectsCode(
    service.db
      .update(tables.asignaciones)
      .set({ canceladaEn: null })
      .where(eq(tables.asignaciones.id, first)),
    'ER_DUP_ENTRY',
  );
  const rows = await service.db.select().from(tables.asignaciones);
  expect(rows).toHaveLength(3);
  expect(rows.filter((r) => r.activa === 1)).toHaveLength(1);
  expect(rows[0].fecha).toBe('2026-11-05');
  expect(rows[0].horaInicio).toBe('08:00:00');
});

it('preserves UUIDv7, all six timestamp digits and UTC across pooled connections', async () => {
  const session = v7();
  await service.db.insert(tables.sesiones).values({
    id: session,
    usuarioId: ids.user,
    tokenHash: 'a'.repeat(64),
    ultimaActividadEn: mark,
    expiraEnAbsoluto: '2026-11-06 12:34:56.654321',
  });
  const [row] = await service.db
    .select()
    .from(tables.sesiones)
    .where(eq(tables.sesiones.id, session));
  expect(row.id).toBe(session);
  expect(row.ultimaActividadEn).toBe(mark);
  expect(row.expiraEnAbsoluto).toBe('2026-11-06 12:34:56.654321');
  const sessions = await Promise.all(
    Array.from({ length: 5 }, () =>
      service.db.execute(
        sql`SELECT @@session.time_zone AS zone, ABS(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(6), NOW(6))) AS delta, SLEEP(0.05)`,
      ),
    ),
  );
  for (const [rows] of sessions) {
    expect(rows[0].zone).toBe('+00:00');
    expect(rows[0].delta).toBe(0);
  }
  const [defaults] = await service.db.execute(
    sql`SELECT ABS(TIMESTAMPDIFF(SECOND, creado_en, UTC_TIMESTAMP(6))) AS age FROM sesiones`,
  );
  expect(defaults[0].age).toBeLessThan(10);
  await rejectsCode(
    service.db.delete(tables.usuarios).where(eq(tables.usuarios.id, ids.user)),
    'ER_ROW_IS_REFERENCED_2',
  );
  await service.db.insert(tables.auditoria).values({
    usuarioId: ids.user,
    sesionId: session,
    accion: 'synthetic:test',
    tipoEntidad: 'synthetic',
    entidadId: session,
    motivo: 'Synthetic integration test',
  });
  await rejectsCode(
    service.db.delete(tables.sesiones).where(eq(tables.sesiones.id, session)),
    'ER_ROW_IS_REFERENCED_2',
  );
});

it('supports atomic DML rollback without claiming DDL rollback', async () => {
  const id = v7();
  await expect(
    service.db.transaction(async (tx) => {
      await tx
        .insert(tables.auditoria)
        .values({ id, accion: 'synthetic:rollback', tipoEntidad: 'synthetic' });
      throw new Error('synthetic rollback');
    }),
  ).rejects.toThrow('synthetic rollback');
  expect(
    await service.db.select().from(tables.auditoria).where(eq(tables.auditoria.id, id)),
  ).toHaveLength(0);
});

it('can enforce append-only audit through runtime account grants', async () => {
  rootSql(`CREATE USER '${runtimeUser}'@'%' IDENTIFIED BY '${runtimePassword}';`);
  runtimeCreated = true;
  rootSql(`GRANT SELECT, INSERT ON \`${database}\`.auditoria TO '${runtimeUser}'@'%';`);
  const connection = await createConnection({
    host: 'localhost',
    port: 3306,
    database,
    user: runtimeUser,
    password: runtimePassword,
  });
  try {
    await connection.query('INSERT INTO auditoria (id, accion, tipo_entidad) VALUES (?, ?, ?)', [
      Buffer.from(v7().replaceAll('-', ''), 'hex'),
      'synthetic:append',
      'synthetic',
    ]);
    await connection.query('SELECT id FROM auditoria');
    await rejectsCode(
      connection.query('UPDATE auditoria SET motivo = ?', ['not allowed']),
      'ER_TABLEACCESS_DENIED_ERROR',
    );
    await rejectsCode(connection.query('DELETE FROM auditoria'), 'ER_TABLEACCESS_DENIED_ERROR');
    await rejectsCode(connection.query('DROP TABLE auditoria'), 'ER_TABLEACCESS_DENIED_ERROR');
  } finally {
    await connection.end();
  }
});

it('starts Nest with the real database, preserves health and cleans up on shutdown', async () => {
  const response = await fetch(`${await app.getUrl()}/api/health`);
  expect(await response.json()).toEqual({ status: 'ok' });
  expect((await fetch(`${await app.getUrl()}/api/users`)).status).toBe(404);
  await app.close();
  app = undefined;
  expect(() => service.db).toThrow('not initialized');
});
