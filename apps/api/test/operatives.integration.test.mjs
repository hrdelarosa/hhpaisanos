import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { v7 } from 'uuid';
import { afterAll, beforeAll, expect, it } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { hashPassword } from '../dist/modules/auth/auth.service.js';
import * as t from '../dist/database/schema/index.js';
import { rootSql } from './helpers/mysql.mjs';

const suffix = randomBytes(8).toString('hex');
const database = `hhpaisanos_test_${suffix}`;
const runtimeUser = `hhp_test_${suffix}`;
const runtimePassword = randomBytes(24).toString('hex');
const password = 'Synthetic operative password 123';
const origin = 'http://localhost:5173';
const envKeys = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_ROOT_PASSWORD',
  'AUTH_ORIGINS',
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let app,
  db,
  baseUrl,
  adminCookie,
  enlaceCookie,
  observerCookie,
  unprivilegedCookie,
  temporaryCookie;
let databaseCreated = false,
  userCreated = false;

beforeAll(async () => {
  // Compose only interpolates these placeholders for exec; root credentials stay in the container.
  process.env.DB_PASSWORD ??= 'synthetic-compose-placeholder';
  process.env.DB_ROOT_PASSWORD ??= 'synthetic-compose-placeholder';
  if (!rootSql('SELECT VERSION();').startsWith('8.4.')) throw new Error('MySQL 8.4 required');
  rootSql(`CREATE DATABASE \`${database}\`;`);
  databaseCreated = true;
  rootSql(`CREATE USER '${runtimeUser}'@'%' IDENTIFIED BY '${runtimePassword}';`);
  userCreated = true;
  rootSql(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${runtimeUser}'@'%';`);
  Object.assign(process.env, {
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_NAME: database,
    DB_USER: runtimeUser,
    DB_PASSWORD: runtimePassword,
    AUTH_ORIGINS: origin,
  });
  const setup = new DatabaseService({
    host: 'localhost',
    port: 3306,
    database,
    user: runtimeUser,
    password: runtimePassword,
    connectionLimit: 5,
  });
  try {
    await setup.onModuleInit();
    await migrate(setup.db, { migrationsFolder: './drizzle' });
  } finally {
    await setup.onModuleDestroy();
  }
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, 'localhost');
  baseUrl = await app.getUrl();
  db = app.get(DatabaseService).db;
  const permissionIds = {};
  for (const code of ['operatives:read', 'operatives:create']) {
    permissionIds[code] = v7();
    await db.insert(t.permisos).values({ id: permissionIds[code], codigo: code });
  }
  const roleIds = {};
  for (const [code, permissions] of [
    ['ADMIN', ['operatives:read', 'operatives:create']],
    ['ENLACE', ['operatives:read']],
    ['OBSERVADOR', []],
  ]) {
    const id = v7();
    roleIds[code] = id;
    await db.insert(t.roles).values({ id, codigo: code, nombre: code, activo: true });
    for (const permission of permissions) {
      await db.insert(t.rolPermisos).values({ rolId: id, permisoId: permissionIds[permission] });
    }
  }
  adminCookie = await account(roleIds.ADMIN);
  enlaceCookie = await account(roleIds.ENLACE);
  observerCookie = await account(roleIds.OBSERVADOR);
  temporaryCookie = await account(roleIds.ADMIN, true);
  // A second ADMIN login exercises removal of live grants below without role-name bypasses.
  unprivilegedCookie = await account(roleIds.ADMIN);
}, 60000);

afterAll(async () => {
  try {
    await app?.close();
  } finally {
    try {
      if (databaseCreated) rootSql(`DROP DATABASE \`${database}\`;`);
      if (userCreated) rootSql(`DROP USER '${runtimeUser}'@'%';`);
    } finally {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }
}, 30000);

function request(path = '', { method = 'GET', cookie = adminCookie, body, csrf = true } = {}) {
  return fetch(`${baseUrl}/api/operatives${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method === 'GET'
        ? {}
        : {
            'Content-Type': 'application/json',
            Origin: origin,
            ...(csrf ? { 'X-HHP-CSRF': '1' } : {}),
          }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function account(roleId, temporary = false) {
  const username = `synthetic-${v7().slice(-12)}`;
  await db.insert(t.usuarios).values({
    rolId: roleId,
    nombreUsuario: username,
    nombreCompleto: 'Synthetic operative administrator',
    passwordHash: await hashPassword(password),
    activo: true,
    debeCambiarPassword: temporary,
    intentosFallidos: 0,
  });
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'X-HHP-CSRF': '1' },
    body: JSON.stringify({ username, password }),
  });
  expect(response.status).toBe(200);
  return response.headers.get('set-cookie').split(';')[0];
}

const input = (name, extra = {}) => ({
  name,
  startDate: '2026-12-01',
  endDate: '2026-12-31',
  ...extra,
});
const create = (body, options = {}) => request('', { method: 'POST', body, ...options });

it('creates drafts, preserves names and calendar dates, retrieves and audits atomically', async () => {
  const response = await create(input('  Invierno Ágil  Guerrero  '));
  expect(response.status).toBe(201);
  const operative = await response.json();
  expect(operative).toEqual({
    id: expect.any(String),
    name: 'Invierno Ágil  Guerrero',
    startDate: '2026-12-01',
    endDate: '2026-12-31',
    status: 'borrador',
    createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
    updatedAt: expect.any(String),
  });
  expect(await (await request(`/${operative.id}`, { cookie: enlaceCookie })).json()).toEqual(
    operative,
  );
  const [stored] = await db.select().from(t.operativos).where(eq(t.operativos.id, operative.id));
  expect(stored.toleranciaMinutos).toBeNull();
  expect(stored.precisionMaximaM).toBeNull();
  const [event] = await db
    .select()
    .from(t.auditoria)
    .where(eq(t.auditoria.entidadId, operative.id));
  expect(event).toMatchObject({
    accion: 'operatives.created',
    tipoEntidad: 'operativos',
    canal: 'web',
    valoresAnteriores: null,
    valoresNuevos: {
      nombre: operative.name,
      fechaInicio: operative.startDate,
      fechaFin: operative.endDate,
      estado: 'borrador',
    },
  });
  const [session] = await db.select().from(t.sesiones).where(eq(t.sesiones.id, event.sesionId));
  expect(event.usuarioId).toBe(session.usuarioId);
  expect(
    (await create(input('Single day', { startDate: '2028-02-29', endDate: '2028-02-29' }))).status,
  ).toBe(201);
});

it('filters literally and paginates with stable ordering while allowing overlapping intervals', async () => {
  for (const name of ['Synthetic % first', 'Synthetic % second', 'Synthetic other']) {
    expect((await create(input(name))).status).toBe(201);
  }
  const first = await (await request('?name=Synthetic%20%25&status=borrador&limit=1')).json();
  const second = await (
    await request('?name=Synthetic%20%25&status=borrador&limit=1&page=2')
  ).json();
  expect(first).toMatchObject({ total: 2, page: 1, limit: 1 });
  expect(second.items).toHaveLength(1);
  expect(first.items[0].id).not.toBe(second.items[0].id);
  expect(await (await request('?status=activo')).json()).toMatchObject({ total: 0, items: [] });
});

it('rejects invalid HTTP inputs without creating operational records', async () => {
  const [{ total: before }] = await db.select({ total: sql`COUNT(*)` }).from(t.operativos);
  for (const body of [
    input('   '),
    input('x'.repeat(121)),
    input(null),
    input(123),
    input('Invalid', { startDate: '2026-02-29' }),
    input('Invalid', { endDate: '2026-13-01' }),
    input('Invalid', { startDate: '2026-12-02', endDate: '2026-12-01' }),
    input('Invalid', { startDate: '2026-12-01T00:00:00Z' }),
    input('Invalid', { startDate: '0000-01-01' }),
    input('Invalid', { endDate: null }),
    input('Invalid', { status: 'borrador' }),
    input('Invalid', { toleranciaMinutos: 10 }),
    { name: 'Missing dates' },
  ])
    expect((await create(body)).status).toBe(400);
  for (const query of [
    '?page=0',
    '?limit=101',
    '?page=1.5',
    '?status=unknown',
    '?extra=1',
    '?page=9007199254740991&limit=100',
  ]) {
    expect((await request(query)).status).toBe(400);
  }
  expect((await request('/invalid')).status).toBe(400);
  expect((await request(`/${v7()}`)).status).toBe(404);
  const [{ total: after }] = await db.select({ total: sql`COUNT(*)` }).from(t.operativos);
  expect(after).toBe(before);
});

it('uses the actual column collation and rejects concurrent equivalent creations', async () => {
  const [columns] =
    await db.execute(sql`SELECT COLLATION_NAME AS collation FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ${database} AND TABLE_NAME = 'operativos' AND COLUMN_NAME = 'nombre'`);
  expect(columns[0].collation).toBe('utf8mb4_0900_ai_ci');
  const results = await Promise.all([
    create(input('  Veráno Concurrente  ')),
    create(input('VERANO CONCURRENTE')),
  ]);
  expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
  expect((await create(input('Verano Concurrente'))).status).toBe(409);
  expect((await create(input('Verano Concurrente', { endDate: '2027-01-01' }))).status).toBe(201);
  expect((await create(input('Verano  Concurrente'))).status).toBe(201);
});

it('enforces explicit permissions, temporary credential restrictions and CSRF', async () => {
  for (const cookie of ['', observerCookie]) {
    const expected = cookie ? 403 : 401;
    expect((await request('', { cookie })).status).toBe(expected);
    expect((await request(`/${v7()}`, { cookie })).status).toBe(expected);
    expect((await create(input('Denied'), { cookie })).status).toBe(expected);
  }
  expect((await create(input('Denied'), { cookie: enlaceCookie })).status).toBe(403);
  expect((await request('', { cookie: temporaryCookie })).status).toBe(403);
  expect((await create(input('Denied'), { cookie: temporaryCookie })).status).toBe(403);
  expect((await create(input('Denied'), { csrf: false })).status).toBe(403);
  const [admin] = await db.select().from(t.roles).where(eq(t.roles.codigo, 'ADMIN'));
  const grants = await db.select().from(t.rolPermisos).where(eq(t.rolPermisos.rolId, admin.id));
  await db.delete(t.rolPermisos).where(eq(t.rolPermisos.rolId, admin.id));
  try {
    expect((await request('', { cookie: unprivilegedCookie })).status).toBe(403);
    expect((await create(input('Denied'), { cookie: unprivilegedCookie })).status).toBe(403);
  } finally {
    await db.insert(t.rolPermisos).values(grants);
  }
});

it('rolls back creation if audit fails and does not misclassify other duplicate errors', async () => {
  // Simulate a different unique-key failure during audit, not the operative constraint.
  rootSql(`CREATE TRIGGER \`${database}\`.synthetic_audit_failure BEFORE INSERT ON \`${database}\`.auditoria
    FOR EACH ROW SIGNAL SQLSTATE '23000' SET MYSQL_ERRNO = 1062,
    MESSAGE_TEXT = 'synthetic-secret-error for key \\'auditoria.other_unique\\'';`);
  try {
    const response = await create(input('Audit rollback'));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('synthetic-secret-error');
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_audit_failure;`);
  }
  expect(
    await db.select().from(t.operativos).where(eq(t.operativos.nombre, 'Audit rollback')),
  ).toEqual([]);
  expect(
    await db
      .select()
      .from(t.auditoria)
      .where(
        and(
          eq(t.auditoria.accion, 'operatives.created'),
          sql`JSON_UNQUOTE(JSON_EXTRACT(${t.auditoria.valoresNuevos}, '$.nombre')) = 'Audit rollback'`,
        ),
      ),
  ).toEqual([]);
});
