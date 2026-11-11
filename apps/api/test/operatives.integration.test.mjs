import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { v7 } from 'uuid';
import { afterAll, beforeAll, expect, it, vi } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { AuthService, hashPassword } from '../dist/modules/auth/auth.service.js';
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
  for (const code of ['operatives:read', 'operatives:create', 'operatives:activate']) {
    permissionIds[code] = v7();
    await db.insert(t.permisos).values({ id: permissionIds[code], codigo: code });
  }
  const roleIds = {};
  for (const [code, permissions] of [
    ['ADMIN', ['operatives:read', 'operatives:create', 'operatives:activate']],
    ['ENLACE', ['operatives:read', 'operatives:activate']],
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
    arrivalToleranceMinutes: null,
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

function civilDay(offset = 0) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

async function activationFixture(extra = {}) {
  const response = await create(
    input(`Activation ${v7()}`, { startDate: civilDay(-1), endDate: civilDay(10), ...extra }),
  );
  expect(response.status).toBe(201);
  return response.json();
}
const activationInput = { reason: 'Approved operational start', arrivalToleranceMinutes: 15 };
const activate = (id, body = activationInput, options = {}) =>
  request(`/${id}/activate`, { method: 'POST', body, ...options });
const operativeRow = async (id) =>
  (await db.select().from(t.operativos).where(eq(t.operativos.id, id)))[0];
const operativeEvents = (id) => db.select().from(t.auditoria).where(eq(t.auditoria.entidadId, id));

it('activates for ADMIN and ENLACE with explicit immutable tolerance and atomic actor/session audit', async () => {
  for (const [cookie, tolerance, dates] of [
    [adminCookie, 15, { startDate: civilDay(), endDate: civilDay() }],
    [enlaceCookie, 0, { startDate: civilDay(1) }],
    [adminCookie, 20, {}],
  ]) {
    const operative = await activationFixture(dates);
    const before = await operativeRow(operative.id);
    const body = { ...activationInput, arrivalToleranceMinutes: tolerance };
    const response = await activate(operative.id, body, { cookie });
    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const stored = await operativeRow(operative.id);
    expect(stored).toMatchObject({
      ...before,
      estado: 'activo',
      toleranciaMinutos: tolerance,
      actualizadoEn: expect.any(String),
    });
    expect(await (await request(`/${operative.id}`)).json()).toMatchObject({
      status: 'activo',
      arrivalToleranceMinutes: tolerance,
    });
    const context = await app.get(AuthService).authenticate({ headers: { cookie } });
    const events = await operativeEvents(operative.id);
    expect(events).toHaveLength(2);
    expect(events.find((event) => event.accion === 'operatives.activated')).toMatchObject({
      usuarioId: context.user.id,
      sesionId: context.sessionId,
      tipoEntidad: 'operativos',
      entidadId: operative.id,
      canal: 'web',
      motivo: body.reason,
      valoresAnteriores: { status: 'borrador', arrivalToleranceMinutes: null },
      valoresNuevos: { status: 'activo', arrivalToleranceMinutes: tolerance },
    });
    expect((await activate(operative.id, body)).status).toBe(409);
    expect((await activate(operative.id, { ...body, arrivalToleranceMinutes: 30 })).status).toBe(
      409,
    );
    expect(await operativeRow(operative.id)).toEqual(stored);
    expect(await operativeEvents(operative.id)).toEqual(events);
  }
});

it('rejects expired and closed operatives and invalid activation DTOs without writes', async () => {
  const operative = await activationFixture();
  const before = await operativeRow(operative.id);
  const events = await operativeEvents(operative.id);
  for (const body of [
    {},
    { reason: 'Missing tolerance' },
    { arrivalToleranceMinutes: 15 },
    { ...activationInput, reason: ' \n\t' },
    { ...activationInput, reason: null },
    { ...activationInput, reason: 123 },
    { ...activationInput, reason: 'x'.repeat(501) },
    ...[null, '15', -1, 65536, 1.5, true].map((arrivalToleranceMinutes) => ({
      ...activationInput,
      arrivalToleranceMinutes,
    })),
    { ...activationInput, status: 'activo' },
    { ...activationInput, startDate: civilDay() },
  ])
    expect((await activate(operative.id, body)).status).toBe(400);
  expect((await activate('invalid')).status).toBe(400);
  expect((await activate(v7())).status).toBe(404);
  expect(await operativeRow(operative.id)).toEqual(before);
  expect(await operativeEvents(operative.id)).toEqual(events);
  for (const closed of [false, true]) {
    const target = await activationFixture(
      closed
        ? {}
        : {
            startDate: civilDay(-10),
            endDate: civilDay(-1),
          },
    );
    if (closed)
      await db
        .update(t.operativos)
        .set({ estado: 'cerrado' })
        .where(eq(t.operativos.id, target.id));
    const original = await operativeRow(target.id),
      audit = await operativeEvents(target.id);
    expect((await activate(target.id)).status).toBe(409);
    expect(await operativeRow(target.id)).toEqual(original);
    expect(await operativeEvents(target.id)).toEqual(audit);
  }
});

it('preserves assignments, their audit and unrelated geographic settings on activation', async () => {
  const operative = await activationFixture();
  const [{ id: observerId }] = await db
    .insert(t.observadores)
    .values({
      nombres: 'Synthetic',
      apellidos: 'Observer',
      activo: true,
    })
    .$returningId();
  const [{ id: moduleId }] = await db
    .insert(t.modulosAtencion)
    .values({
      nombre: 'Synthetic module',
      municipio: 'Synthetic',
      activo: true,
    })
    .$returningId();
  const context = await app.get(AuthService).authenticate({ headers: { cookie: adminCookie } });
  await db.insert(t.asignaciones).values({
    operativoId: operative.id,
    observadorId: observerId,
    moduloId: moduleId,
    vigenteDesde: operative.startDate,
    vigenteHasta: operative.endDate,
    horaInicio: '09:00:00',
    horaFin: '17:00:00',
    creadoPor: context.user.id,
  });
  await db
    .update(t.operativos)
    .set({ precisionMaximaM: 50 })
    .where(eq(t.operativos.id, operative.id));
  const assignments = await db.select().from(t.asignaciones);
  const audit = await db.select().from(t.auditoria);
  expect((await activate(operative.id)).status).toBe(204);
  expect(await db.select().from(t.asignaciones)).toEqual(assignments);
  expect(await db.select().from(t.auditoria)).toEqual(expect.arrayContaining(audit));
  expect((await operativeRow(operative.id)).precisionMaximaM).toBe(50);
});

it('uses the Mexico City civil date rather than the UTC date at expiration', async () => {
  const dates = { startDate: '2030-12-01', endDate: '2030-12-31' };
  const lastDay = await activationFixture(dates),
    expired = await activationFixture(dates);
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2031-01-01T05:59:59.999Z'));
    expect((await activate(lastDay.id)).status).toBe(204);
    vi.setSystemTime(new Date('2031-01-01T06:00:00.000Z'));
    expect((await activate(expired.id)).status).toBe(409);
    expect((await operativeRow(expired.id)).estado).toBe('borrador');
    expect(await operativeEvents(expired.id)).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});

it('requires the exact activation permission, valid definitive sessions and CSRF', async () => {
  const operative = await activationFixture();
  for (const [cookie, expected] of [
    ['', 401],
    [observerCookie, 403],
    [temporaryCookie, 403],
  ])
    expect((await activate(operative.id, activationInput, { cookie })).status).toBe(expected);
  expect((await activate(operative.id, activationInput, { csrf: false })).status).toBe(403);
  const [permission] = await db
    .select()
    .from(t.permisos)
    .where(eq(t.permisos.codigo, 'operatives:activate'));
  for (const [code, cookie] of [
    ['ADMIN', adminCookie],
    ['ENLACE', enlaceCookie],
  ]) {
    const [role] = await db.select().from(t.roles).where(eq(t.roles.codigo, code));
    const where = and(eq(t.rolPermisos.rolId, role.id), eq(t.rolPermisos.permisoId, permission.id));
    await db.delete(t.rolPermisos).where(where);
    try {
      expect((await activate(operative.id, activationInput, { cookie })).status).toBe(403);
    } finally {
      await db.insert(t.rolPermisos).values({ rolId: role.id, permisoId: permission.id });
    }
  }
  expect((await operativeRow(operative.id)).estado).toBe('borrador');
  expect(await operativeEvents(operative.id)).toHaveLength(1);
});

it('serializes competing activations across actors and commits exactly one decision', async () => {
  const operative = await activationFixture();
  const results = await Promise.all([
    activate(operative.id),
    activate(
      operative.id,
      { ...activationInput, arrivalToleranceMinutes: 20 },
      { cookie: enlaceCookie },
    ),
  ]);
  expect(results.map((response) => response.status).sort((a, b) => a - b)).toEqual([204, 409]);
  expect((await operativeRow(operative.id)).toleranciaMinutos).toBe(
    results[0].status === 204 ? 15 : 20,
  );
  expect(
    (await operativeEvents(operative.id)).filter(
      (event) => event.accion === 'operatives.activated',
    ),
  ).toHaveLength(1);
});

it('rolls back activation and tolerance if its audit fails without leaking driver details', async () => {
  const operative = await activationFixture();
  const before = await operativeRow(operative.id),
    audit = await operativeEvents(operative.id);
  rootSql(`CREATE TRIGGER \`${database}\`.synthetic_activation_audit_failure BEFORE INSERT ON \`${database}\`.auditoria
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic-private-activation';`);
  try {
    const response = await activate(operative.id);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('synthetic-private-activation');
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_activation_audit_failure;`);
  }
  expect(await operativeRow(operative.id)).toEqual(before);
  expect(await operativeEvents(operative.id)).toEqual(audit);
});

it('revalidates authority when activation waits behind permission changes or logout', async () => {
  const [role] = await db.select().from(t.roles).where(eq(t.roles.codigo, 'ENLACE'));
  const [permission] = await db
    .select()
    .from(t.permisos)
    .where(eq(t.permisos.codigo, 'operatives:activate'));
  for (const operation of ['permission', 'logout']) {
    const cookie = await account(role.id);
    const context = await app.get(AuthService).authenticate({ headers: { cookie } });
    const operative = await activationFixture();
    const locked = Promise.withResolvers(),
      release = Promise.withResolvers();
    const revoke = db.transaction(async (tx) => {
      await tx.select().from(t.usuarios).where(eq(t.usuarios.id, context.user.id)).for('update');
      locked.resolve();
      await release.promise;
      if (operation === 'permission')
        await tx
          .delete(t.rolPermisos)
          .where(and(eq(t.rolPermisos.rolId, role.id), eq(t.rolPermisos.permisoId, permission.id)));
      else
        await tx
          .update(t.sesiones)
          .set({ revocadaEn: sql`UTC_TIMESTAMP(6)` })
          .where(eq(t.sesiones.id, context.sessionId));
    });
    let pending;
    try {
      await locked.promise;
      pending = activate(operative.id, activationInput, { cookie });
      await expect
        .poll(
          () =>
            rootSql(`SELECT COUNT(*) FROM performance_schema.data_lock_waits w
        JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.BLOCKING_ENGINE_LOCK_ID
        WHERE l.OBJECT_SCHEMA = '${database}' AND l.OBJECT_NAME = 'usuarios';`),
          { timeout: 10000 },
        )
        .not.toBe('0');
    } finally {
      release.resolve();
      await revoke;
      try {
        if (pending) expect((await pending).status).toBe(operation === 'permission' ? 403 : 401);
      } finally {
        if (operation === 'permission')
          await db.insert(t.rolPermisos).values({ rolId: role.id, permisoId: permission.id });
      }
    }
    expect((await operativeRow(operative.id)).estado).toBe('borrador');
    expect(await operativeEvents(operative.id)).toHaveLength(1);
  }
});
