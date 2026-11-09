import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
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
const password = 'Synthetic attention module password 123';
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
const codes = [
  'attention-modules:read',
  'attention-modules:create',
  'attention-modules:update',
  'attention-modules:change-status',
];
const roles = {},
  permissions = {},
  accounts = {};
let app, db, baseUrl, adminCookie, enlaceCookie, observerCookie, temporaryCookie;
let databaseCreated = false,
  userCreated = false;

beforeAll(async () => {
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
  for (const code of codes) {
    permissions[code] = v7();
    await db.insert(t.permisos).values({ id: permissions[code], codigo: code });
  }
  for (const code of ['ADMIN', 'ENLACE', 'OBSERVADOR']) {
    roles[code] = v7();
    await db.insert(t.roles).values({ id: roles[code], codigo: code, nombre: code, activo: true });
    if (code !== 'OBSERVADOR') {
      await db
        .insert(t.rolPermisos)
        .values(
          codes.map((permission) => ({ rolId: roles[code], permisoId: permissions[permission] })),
        );
    }
    accounts[code] = await account(roles[code]);
  }
  adminCookie = accounts.ADMIN.cookie;
  enlaceCookie = accounts.ENLACE.cookie;
  observerCookie = accounts.OBSERVADOR.cookie;
  temporaryCookie = (await account(roles.ADMIN, true)).cookie;
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
  return fetch(`${baseUrl}/api/attention-modules${path}`, {
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
  const id = v7(),
    username = `synthetic-${id.slice(-12)}`;
  await db.insert(t.usuarios).values({
    id,
    rolId: roleId,
    nombreUsuario: username,
    nombreCompleto: 'Synthetic module administrator',
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
  return { id, cookie: response.headers.get('set-cookie').split(';')[0] };
}

const input = (name, extra = {}) => ({ name, municipality: 'Synthetic municipality', ...extra });
const create = (body, options = {}) => request('', { method: 'POST', body, ...options });
const update = (id, body, options = {}) => request(`/${id}`, { method: 'PATCH', body, ...options });
const status = (id, active, options = {}) =>
  request(`/${id}/status`, {
    method: 'PATCH',
    body: { active, reason: 'Synthetic status reason' },
    ...options,
  });
async function created(name, extra = {}, options = {}) {
  const response = await create(input(name, extra), options);
  expect(response.status).toBe(201);
  return response.json();
}
const stored = async (id) =>
  (await db.select().from(t.modulosAtencion).where(eq(t.modulosAtencion.id, id)))[0];
const events = (id) =>
  db
    .select()
    .from(t.auditoria)
    .where(eq(t.auditoria.entidadId, id))
    .orderBy(t.auditoria.creadoEn, t.auditoria.id);

async function assignmentValues(moduleId, cancelled = false) {
  const [{ id: observerId }] = await db
    .insert(t.observadores)
    .values({ nombres: 'Synthetic', apellidos: 'Observer', activo: true })
    .$returningId();
  const [{ id: operativeId }] = await db
    .insert(t.operativos)
    .values({
      nombre: `Synthetic ${v7()}`,
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-31',
      estado: 'borrador',
    })
    .$returningId();
  return {
    moduloId: moduleId,
    observadorId: observerId,
    operativoId: operativeId,
    vigenteDesde: '2026-12-01',
    vigenteHasta: '2026-12-31',
    horaInicio: '08:00:00',
    horaFin: '16:00:00',
    creadoPor: accounts.ADMIN.id,
    canceladaEn: cancelled ? '2026-11-01 00:00:00.000000' : null,
  };
}

it('creates active modules, normalizes only surrounding whitespace, retrieves and audits atomically', async () => {
  const module = await created(
    '  Módulo  Ágil  ',
    { municipality: '  Municipio  Ágil  ' },
    { cookie: enlaceCookie },
  );
  expect(module).toEqual({
    id: expect.any(String),
    name: 'Módulo  Ágil',
    municipality: 'Municipio  Ágil',
    active: true,
    createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
    updatedAt: expect.any(String),
  });
  expect(await (await request(`/${module.id}`, { cookie: enlaceCookie })).json()).toEqual(module);
  expect(await stored(module.id)).toMatchObject({
    latitud: null,
    longitud: null,
    radioValidacionM: null,
  });
  const [event] = await events(module.id);
  expect(event).toMatchObject({
    accion: 'attention-modules.created',
    tipoEntidad: 'modulos_atencion',
    usuarioId: accounts.ENLACE.id,
    canal: 'web',
    valoresAnteriores: null,
    valoresNuevos: { nombre: module.name, municipio: module.municipality, activo: true },
  });
  const [session] = await db.select().from(t.sesiones).where(eq(t.sesiones.id, event.sesionId));
  expect(session.usuarioId).toBe(event.usuarioId);
  // There is deliberately no business-key uniqueness restriction.
  await created(module.name, { municipality: module.municipality });
});

it('filters literally, combines municipality and status, and paginates consistently', async () => {
  const first = await created('Filter %_ first', { municipality: 'Exact municipality' });
  await created('Filter %_ second', { municipality: 'Exact municipality' });
  await created('Filter other', { municipality: 'Exact municipality' });
  await created('Filter %_ elsewhere', { municipality: 'Other municipality' });
  const query = '?name=Filter%20%25_&municipality=Exact%20municipality&active=true&limit=1';
  const page1 = await (await request(query)).json();
  const page2 = await (await request(`${query}&page=2`)).json();
  expect(page1).toMatchObject({ total: 2, page: 1, limit: 1 });
  expect(page2).toMatchObject({ total: 2, page: 2, limit: 1 });
  expect(page1.items[0].id).not.toBe(page2.items[0].id);
  expect(page2.items[0].id).toBe(first.id);
  expect((await status(first.id, false)).status).toBe(204);
  expect(await (await request('?name=Filter%20%25_&active=false')).json()).toMatchObject({
    total: 1,
    items: [{ id: first.id }],
  });
  expect(await (await request('?municipality=Exact')).json()).toMatchObject({ total: 0 });
  expect(await (await request('?name=Filter%20%25_')).json()).toMatchObject({
    total: 3,
    page: 1,
    limit: 20,
  });
});

it('rejects invalid input and unknown fields without operational or audit writes', async () => {
  const module = await created('Validation target');
  const before = await stored(module.id),
    auditBefore = await events(module.id);
  for (const body of [
    input(' '),
    input(null),
    input(1),
    input('x'.repeat(121)),
    input('Valid', { municipality: ' ' }),
    input('Valid', { municipality: null }),
    input('Valid', { municipality: 'x'.repeat(101) }),
    { name: 'Missing municipality' },
    { municipality: 'Missing name' },
    input('Valid', { active: true }),
    input('Valid', { latitude: 17, longitude: -99 }),
    input('Valid', { validationRadiusM: 10 }),
    input('Valid', { latitud: null }),
  ])
    expect((await create(body)).status).toBe(400);
  for (const body of [
    {},
    { reason: 'Only reason' },
    { name: null, reason: 'Invalid' },
    { name: ' ', reason: 'Invalid' },
    { name: 'x'.repeat(121), reason: 'Invalid' },
    { municipality: null, reason: 'Invalid' },
    { municipality: 'x'.repeat(101), reason: 'Invalid' },
    { name: 'Valid' },
    { name: 'Valid', reason: ' ' },
    { name: 'Valid', reason: 'x'.repeat(501) },
    { name: 'Valid', reason: 'Valid', active: false },
    { name: 'Valid', reason: 'Valid', latitude: 17 },
  ])
    expect((await update(module.id, body)).status).toBe(400);
  for (const body of [
    { active: 'false', reason: 'Invalid' },
    { active: 0, reason: 'Invalid' },
    { active: null, reason: 'Invalid' },
    { active: false },
    { active: false, reason: ' ' },
    { active: false, reason: 'x'.repeat(501) },
    { active: false, reason: 'Valid', name: 'Invalid' },
  ])
    expect((await request(`/${module.id}/status`, { method: 'PATCH', body })).status).toBe(400);
  for (const query of [
    '?page=0',
    '?page=',
    '?page=1.5',
    '?page=true',
    '?page=1&page=2',
    '?limit=101',
    '?limit=',
    '?limit=1&limit=2',
    '?active=0',
    '?active=',
    '?active=true&active=false',
    '?name=a&name=b',
    '?municipality=a&municipality=b',
    '?extra=1',
    '?page=9007199254740991&limit=100',
  ])
    expect((await request(query)).status).toBe(400);
  expect((await request('/invalid')).status).toBe(400);
  expect((await request(`/${v7()}`)).status).toBe(404);
  expect((await update(v7(), { name: 'Missing', reason: 'Valid' })).status).toBe(404);
  expect((await status(v7(), false)).status).toBe(404);
  expect(await stored(module.id)).toEqual(before);
  expect(await events(module.id)).toEqual(auditBefore);
});

it('edits only permitted fields, preserves geographic values, and makes repeats no-ops', async () => {
  const module = await created('Editable');
  await db
    .update(t.modulosAtencion)
    .set({ latitud: '17.123456', longitud: '-99.123456', radioValidacionM: 123 })
    .where(eq(t.modulosAtencion.id, module.id));
  expect(
    (
      await update(
        module.id,
        { name: '  Edited  Ágil  ', reason: 'Synthetic correction' },
        { cookie: enlaceCookie },
      )
    ).status,
  ).toBe(204);
  expect(
    (
      await update(module.id, {
        municipality: '  Changed  Municipality  ',
        reason: 'Synthetic correction',
      })
    ).status,
  ).toBe(204);
  const row = await stored(module.id),
    audit = await events(module.id);
  expect(row).toMatchObject({
    nombre: 'Edited  Ágil',
    municipio: 'Changed  Municipality',
    latitud: '17.123456',
    longitud: '-99.123456',
    radioValidacionM: 123,
    activo: true,
  });
  expect(audit[1]).toMatchObject({
    accion: 'attention-modules.updated',
    valoresAnteriores: { nombre: 'Editable' },
    valoresNuevos: { nombre: 'Edited  Ágil' },
    motivo: 'Synthetic correction',
  });
  expect(audit[2]).toMatchObject({
    valoresAnteriores: { municipio: 'Synthetic municipality' },
    valoresNuevos: { municipio: 'Changed  Municipality' },
  });
  expect(JSON.stringify(audit)).not.toContain('17.123456');
  expect(JSON.stringify(audit)).not.toContain('radioValidacionM');
  expect(await (await request(`/${module.id}`)).json()).not.toHaveProperty('latitude');
  expect(
    (
      await update(module.id, {
        name: 'Edited  Ágil',
        municipality: 'Changed  Municipality',
        reason: 'Repeated',
      })
    ).status,
  ).toBe(204);
  expect(await stored(module.id)).toEqual(row);
  expect(await events(module.id)).toEqual(audit);
});

it('blocks effective edits with any assignment, but status changes preserve all relationships', async () => {
  for (const cancelled of [false, true]) {
    const module = await created(`Referenced ${cancelled}`);
    const values = await assignmentValues(module.id, cancelled);
    const [{ id }] = await db.insert(t.asignaciones).values(values).$returningId();
    const [before] = await db.select().from(t.asignaciones).where(eq(t.asignaciones.id, id));
    expect(
      (await update(module.id, { name: 'Forbidden correction', reason: 'Synthetic' })).status,
    ).toBe(409);
    expect(
      (await update(module.id, { municipality: 'Forbidden municipality', reason: 'Synthetic' }))
        .status,
    ).toBe(409);
    expect((await update(module.id, { name: module.name, reason: 'Repeated' })).status).toBe(204);
    expect((await status(module.id, false, { cookie: enlaceCookie })).status).toBe(204);
    const inactive = await stored(module.id),
      audit = await events(module.id);
    expect(inactive).toMatchObject({
      nombre: module.name,
      municipio: module.municipality,
      activo: false,
    });
    expect(audit).toHaveLength(2);
    expect(audit[1]).toMatchObject({
      accion: 'attention-modules.deactivated',
      valoresAnteriores: { activo: true },
      valoresNuevos: { activo: false },
      motivo: 'Synthetic status reason',
    });
    expect((await status(module.id, false)).status).toBe(204);
    expect(await stored(module.id)).toEqual(inactive);
    expect(await events(module.id)).toEqual(audit);
    expect((await status(module.id, true)).status).toBe(204);
    expect((await events(module.id))[2]).toMatchObject({
      accion: 'attention-modules.activated',
      valoresAnteriores: { activo: false },
      valoresNuevos: { activo: true },
    });
    expect(await db.select().from(t.asignaciones).where(eq(t.asignaciones.id, id))).toEqual([
      before,
    ]);
  }
});

it('requires the exact permission on every route without role-name bypasses', async () => {
  const module = await created('Authorization target');
  const routes = [
    ['', 'GET', undefined, codes[0]],
    [`/${module.id}`, 'GET', undefined, codes[0]],
    ['', 'POST', input('Denied'), codes[1]],
    [`/${module.id}`, 'PATCH', { name: 'Denied', reason: 'Synthetic' }, codes[2]],
    [`/${module.id}/status`, 'PATCH', { active: false, reason: 'Synthetic' }, codes[3]],
  ];
  const before = await stored(module.id),
    audit = await events(module.id);
  for (const [path, method, body, code] of routes) {
    for (const [cookie, expected] of [
      ['', 401],
      [observerCookie, 403],
      [temporaryCookie, 403],
    ])
      expect((await request(path, { method, body, cookie })).status).toBe(expected);
    await db
      .delete(t.rolPermisos)
      .where(
        and(eq(t.rolPermisos.rolId, roles.ADMIN), eq(t.rolPermisos.permisoId, permissions[code])),
      );
    try {
      expect((await request(path, { method, body })).status).toBe(403);
    } finally {
      await db.insert(t.rolPermisos).values({ rolId: roles.ADMIN, permisoId: permissions[code] });
    }
    if (method !== 'GET')
      expect((await request(path, { method, body, csrf: false })).status).toBe(403);
  }
  expect(await stored(module.id)).toEqual(before);
  expect(await events(module.id)).toEqual(audit);
});

it('rolls back every mutation if auditing fails without exposing database errors', async () => {
  const module = await created('Audit failure target');
  const before = await stored(module.id),
    audit = await events(module.id);
  rootSql(`CREATE TRIGGER \`${database}\`.synthetic_audit_failure BEFORE INSERT ON \`${database}\`.auditoria
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic-secret-audit-error';`);
  try {
    for (const run of [
      () => create(input('Audit rollback creation')),
      () => update(module.id, { name: 'Audit rollback update', reason: 'Synthetic' }),
      () => status(module.id, false),
    ]) {
      const response = await run();
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('synthetic-secret-audit-error');
    }
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_audit_failure;`);
  }
  expect(await stored(module.id)).toEqual(before);
  expect(await events(module.id)).toEqual(audit);
  expect(
    await db
      .select()
      .from(t.modulosAtencion)
      .where(eq(t.modulosAtencion.nombre, 'Audit rollback creation')),
  ).toEqual([]);
});

it('serializes concurrent partial edits and repeated status changes with truthful audit history', async () => {
  const module = await created('Concurrent original');
  const edits = await Promise.all([
    update(module.id, { name: 'Concurrent name', reason: 'Synthetic' }),
    update(
      module.id,
      { municipality: 'Concurrent municipality', reason: 'Synthetic' },
      { cookie: enlaceCookie },
    ),
  ]);
  expect(edits.map((response) => response.status)).toEqual([204, 204]);
  expect(await stored(module.id)).toMatchObject({
    nombre: 'Concurrent name',
    municipio: 'Concurrent municipality',
  });
  const changes = await Promise.all([
    status(module.id, false),
    status(module.id, false, { cookie: enlaceCookie }),
  ]);
  expect(changes.map((response) => response.status)).toEqual([204, 204]);
  expect((await events(module.id)).map((event) => event.accion).sort()).toEqual([
    'attention-modules.created',
    'attention-modules.deactivated',
    'attention-modules.updated',
    'attention-modules.updated',
  ]);
});

it('waits for a concurrent assignment insert and then rejects editing its referenced module', async () => {
  const module = await created('Concurrent assignment target');
  const values = await assignmentValues(module.id);
  // Keep the assignment creator's FK lock independent from the editing actor's lock.
  values.creadoPor = accounts.OBSERVADOR.id;
  const inserted = Promise.withResolvers(),
    release = Promise.withResolvers();
  const insert = db.transaction(async (tx) => {
    await tx.insert(t.asignaciones).values(values);
    inserted.resolve();
    await release.promise;
  });
  let pending;
  try {
    await inserted.promise;
    pending = update(module.id, { name: 'Must not change', reason: 'Synthetic' });
    await expect
      .poll(
        () =>
          rootSql(`SELECT COUNT(*) FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.BLOCKING_ENGINE_LOCK_ID
      WHERE l.OBJECT_SCHEMA = '${database}' AND l.OBJECT_NAME = 'modulos_atencion';`),
        { timeout: 10000 },
      )
      .not.toBe('0');
  } finally {
    release.resolve();
    await insert;
  }
  expect((await pending).status).toBe(409);
  expect((await stored(module.id)).nombre).toBe(module.name);
  expect(await events(module.id)).toHaveLength(1);
});

it('revalidates permissions after authentication when a write waits on the actor lock', async () => {
  const module = await created('Permission race target');
  const locked = Promise.withResolvers(),
    release = Promise.withResolvers();
  const revoke = db.transaction(async (tx) => {
    await tx
      .select({ id: t.usuarios.id })
      .from(t.usuarios)
      .where(eq(t.usuarios.id, accounts.ADMIN.id))
      .for('update');
    locked.resolve();
    await release.promise;
    await tx
      .delete(t.rolPermisos)
      .where(
        and(
          eq(t.rolPermisos.rolId, roles.ADMIN),
          eq(t.rolPermisos.permisoId, permissions['attention-modules:update']),
        ),
      );
  });
  let pending;
  try {
    await locked.promise;
    pending = update(module.id, { name: 'Must not change', reason: 'Synthetic' });
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
      expect((await pending).status).toBe(403);
    } finally {
      await db
        .insert(t.rolPermisos)
        .values({ rolId: roles.ADMIN, permisoId: permissions['attention-modules:update'] });
    }
  }
  expect((await stored(module.id)).nombre).toBe(module.name);
  expect(await events(module.id)).toHaveLength(1);
});
