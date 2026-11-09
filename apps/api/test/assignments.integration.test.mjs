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
const password = 'Synthetic assignments password 123';
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
  'assignments:read',
  'assignments:create',
  'assignments:update',
  'assignments:cancel',
];
const roles = {},
  permissions = {},
  accounts = {};
let app,
  db,
  baseUrl,
  databaseCreated = false,
  userCreated = false;
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
function day(offset) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

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
    if (code !== 'OBSERVADOR')
      await db
        .insert(t.rolPermisos)
        .values(
          codes.map((permission) => ({ rolId: roles[code], permisoId: permissions[permission] })),
        );
    accounts[code] = await account(roles[code]);
  }
  accounts.temporary = await account(roles.ADMIN, true);
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

async function account(roleId, temporary = false) {
  const id = v7(),
    username = `synthetic-${id.slice(-12)}`;
  await db.insert(t.usuarios).values({
    id,
    rolId: roleId,
    nombreUsuario: username,
    nombreCompleto: 'Synthetic scheduler',
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

function request(
  path = '',
  { method = 'GET', cookie = accounts.ADMIN.cookie, body, csrf = true } = {},
) {
  return fetch(`${baseUrl}/api/assignments${path}`, {
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
async function resources(status = 'borrador') {
  const [{ id: operativeId }] = await db
    .insert(t.operativos)
    .values({
      nombre: `Synthetic ${v7()}`,
      fechaInicio: day(-10),
      fechaFin: day(100),
      estado: status,
    })
    .$returningId();
  const [{ id: observerId }] = await db
    .insert(t.observadores)
    .values({ nombres: 'Synthetic', apellidos: 'Observer', activo: true })
    .$returningId();
  const [{ id: attentionModuleId }] = await db
    .insert(t.modulosAtencion)
    .values({ nombre: 'Synthetic module', municipio: 'Synthetic municipality', activo: true })
    .$returningId();
  return {
    operativeId,
    observerId,
    attentionModuleId,
    validFrom: day(1),
    validTo: day(30),
    startTime: '09:00:00',
    endTime: '17:00:00',
  };
}
const create = (body, options = {}) => request('', { method: 'POST', body, ...options });
async function created(body, options) {
  const response = await create(body, options);
  expect(response.status).toBe(201);
  return response.json();
}
const modify = (assignment, operation, extra = {}, options = {}) =>
  request(`/${assignment.id}/${operation}`, {
    method: 'POST',
    body: { reason: 'Synthetic decision', expectedVersion: assignment.version, ...extra },
    ...options,
  });
const detail = async (id) => (await request(`/${id}`)).json();
const stored = async (id) =>
  (await db.select().from(t.asignaciones).where(eq(t.asignaciones.id, id)))[0];
const events = (id) =>
  db
    .select()
    .from(t.auditoria)
    .where(eq(t.auditoria.entidadId, id))
    .orderBy(t.auditoria.creadoEn, t.auditoria.id);

it('creates one persistent period in draft or active operatives and projects only approved fields', async () => {
  for (const status of ['borrador', 'activo']) {
    const input = await resources(status);
    const assignment = await created(input, { cookie: accounts.ENLACE.cookie });
    expect(assignment).toEqual({
      ...input,
      id: expect.any(String),
      version: 1,
      cancelledAt: null,
      createdBy: accounts.ENLACE.id,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
      updatedAt: expect.any(String),
    });
    expect(await detail(assignment.id)).toEqual(assignment);
    expect(
      await db
        .select()
        .from(t.asignaciones)
        .where(eq(t.asignaciones.observadorId, input.observerId)),
    ).toHaveLength(1);
    expect((await events(assignment.id))[0]).toMatchObject({
      accion: 'assignments.created',
      tipoEntidad: 'asignaciones',
      usuarioId: accounts.ENLACE.id,
      sesionId: expect.any(String),
      canal: 'web',
    });
  }
});

it('rejects invalid DTOs, missing or inactive references and closed/out-of-range operatives', async () => {
  const input = await resources();
  for (const extra of [
    { validFrom: '2027-02-29' },
    { validFrom: null },
    { validFrom: day(31) },
    { startTime: '09:00' },
    { startTime: '17:00:00' },
    { endTime: '24:00:00' },
    { endTime: '08:00:00' },
    { observerId: 'bad' },
    { cancelledAt: null },
    { version: 1 },
    { fecha: day(1) },
  ])
    expect((await create({ ...input, ...extra })).status).toBe(400);
  for (const key of ['operativeId', 'observerId', 'attentionModuleId'])
    expect((await create({ ...input, [key]: v7() })).status).toBe(404);
  expect((await create({ ...input, validFrom: day(-11) })).status).toBe(409);
  expect((await create({ ...input, validTo: day(101) })).status).toBe(409);
  expect((await create(await resources('cerrado'))).status).toBe(409);
  for (const [table, id] of [
    [t.observadores, input.observerId],
    [t.modulosAtencion, input.attentionModuleId],
  ]) {
    await db.update(table).set({ activo: false }).where(eq(table.id, id));
    expect((await create(input)).status).toBe(409);
    await db.update(table).set({ activo: true }).where(eq(table.id, id));
  }
  const assignment = await created(input);
  for (const extra of [
    { reason: '' },
    { reason: 'x'.repeat(501) },
    { reason: null },
    { expectedVersion: '1' },
    { expectedVersion: 0 },
    { expectedVersion: 1.5 },
    { expectedVersion: null },
    { unknown: 1 },
  ])
    expect((await modify(assignment, 'cancel', extra)).status).toBe(400);
  expect((await modify(assignment, 'change', { effectiveFrom: day(2) })).status).toBe(400);
  expect(
    (await modify(assignment, 'change', { effectiveFrom: day(2), startTime: null })).status,
  ).toBe(400);
  expect((await request('/invalid')).status).toBe(400);
  expect((await request(`/${v7()}`)).status).toBe(404);
  expect((await modify({ id: v7(), version: 1 }, 'cancel')).status).toBe(404);
});

it('excludes overlapping periods across operatives regardless of daily hours and filters history', async () => {
  const input = await resources();
  const first = await created(input);
  const other = await resources();
  for (const [from, to] of [
    [0, 1],
    [30, 31],
    [5, 10],
    [0, 40],
  ])
    expect(
      (
        await create({
          ...other,
          observerId: input.observerId,
          validFrom: day(from),
          validTo: day(to),
          startTime: '18:00:00',
          endTime: '20:00:00',
        })
      ).status,
    ).toBe(409);
  const adjacent = await created({ ...input, validFrom: day(31), validTo: day(40) });
  const query = `?operativeId=${input.operativeId}&observerId=${input.observerId}&attentionModuleId=${input.attentionModuleId}`;
  expect(await (await request(`${query}&limit=1`)).json()).toMatchObject({
    total: 2,
    items: [{ id: first.id }],
    page: 1,
    limit: 1,
  });
  expect(await (await request(`${query}&limit=1&page=2`)).json()).toMatchObject({
    total: 2,
    items: [{ id: adjacent.id }],
  });
  expect(await (await request(`${query}&from=${day(30)}&to=${day(31)}`)).json()).toMatchObject({
    total: 2,
  });
  expect((await modify(first, 'cancel')).status).toBe(204);
  expect(await (await request(`${query}&cancelled=true`)).json()).toMatchObject({
    total: 1,
    items: [{ id: first.id }],
  });
  expect(await (await request(`${query}&applicableOn=${day(1)}`)).json()).toMatchObject({
    total: 0,
  });
  expect(await (await request(query)).json()).toMatchObject({ total: 2 });
  await created(input);
  for (const query of [
    '?limit=101',
    '?page=0',
    '?page=1&page=2',
    '?limit=',
    '?page=9007199254740991&limit=100',
    '?cancelled=1',
    '?from=invalid',
    `?from=${day(2)}&to=${day(1)}`,
    '?extra=1',
  ])
    expect((await request(query)).status).toBe(400);
});

it('splits atomically at D, preserves old working conditions and leaves later periods untouched', async () => {
  const input = await resources();
  const original = await created({ ...input, validFrom: day(-2) });
  const later = await created({ ...input, validFrom: day(31), validTo: day(40) });
  const laterBefore = await stored(later.id);
  const newModule = (await resources()).attentionModuleId;
  const response = await modify(
    original,
    'change',
    {
      effectiveFrom: day(10),
      attentionModuleId: newModule,
      startTime: '10:00:00',
      endTime: '18:00:00',
    },
    { cookie: accounts.ENLACE.cookie },
  );
  expect(response.status).toBe(201);
  const next = await response.json();
  expect(next).toMatchObject({
    operativeId: original.operativeId,
    observerId: original.observerId,
    attentionModuleId: newModule,
    validFrom: day(10),
    validTo: day(30),
    version: 1,
  });
  expect(await detail(original.id)).toMatchObject({
    validFrom: day(-2),
    validTo: day(9),
    startTime: '09:00:00',
    endTime: '17:00:00',
    attentionModuleId: original.attentionModuleId,
    version: 2,
    cancelledAt: null,
    createdBy: original.createdBy,
  });
  expect(await stored(later.id)).toEqual(laterBefore);
  expect((await events(original.id))[1]).toMatchObject({
    accion: 'assignments.changed',
    valoresNuevos: { replacementId: next.id, validTo: day(9), version: 2 },
  });
  expect((await events(next.id))[0]).toMatchObject({
    valoresNuevos: { previousAssignmentId: original.id },
    motivo: 'Synthetic decision',
  });
  expect(
    (await modify(original, 'change', { effectiveFrom: day(2), startTime: '08:00:00' })).status,
  ).toBe(409);
  const current = await detail(original.id);
  for (const d of [-1, 0, 10])
    expect(
      (await modify(current, 'change', { effectiveFrom: day(d), startTime: '08:00:00' })).status,
    ).toBe(409);
});

it('replaces a whole future period by cancellation, enforces active rescheduling resources, and keeps no-ops unchanged', async () => {
  const input = await resources();
  const original = await created(input);
  const before = await stored(original.id),
    audit = await events(original.id);
  expect(
    (await modify(original, 'change', { effectiveFrom: day(1), startTime: original.startTime }))
      .status,
  ).toBe(204);
  expect(await stored(original.id)).toEqual(before);
  expect(await events(original.id)).toEqual(audit);
  await db
    .update(t.observadores)
    .set({ activo: false })
    .where(eq(t.observadores.id, input.observerId));
  expect(
    (await modify(original, 'change', { effectiveFrom: day(1), startTime: '08:00:00' })).status,
  ).toBe(409);
  await db
    .update(t.observadores)
    .set({ activo: true })
    .where(eq(t.observadores.id, input.observerId));
  await db
    .update(t.modulosAtencion)
    .set({ activo: false })
    .where(eq(t.modulosAtencion.id, input.attentionModuleId));
  expect(
    (await modify(original, 'change', { effectiveFrom: day(1), startTime: '08:00:00' })).status,
  ).toBe(409);
  await db
    .update(t.modulosAtencion)
    .set({ activo: true })
    .where(eq(t.modulosAtencion.id, input.attentionModuleId));
  const response = await modify(original, 'change', {
    effectiveFrom: day(1),
    startTime: '08:00:00',
  });
  expect(response.status).toBe(201);
  expect(await detail(original.id)).toMatchObject({
    cancelledAt: expect.any(String),
    validFrom: input.validFrom,
    validTo: input.validTo,
    startTime: '09:00:00',
    version: 2,
  });
  const next = await response.json();
  expect(next).toMatchObject({
    validFrom: input.validFrom,
    validTo: input.validTo,
    startTime: '08:00:00',
  });
  expect(
    (
      await modify(await detail(original.id), 'change', {
        effectiveFrom: day(2),
        startTime: '07:00:00',
      })
    ).status,
  ).toBe(409);
});

it('terminates started assignments without rewriting elapsed days and cancels only future programming', async () => {
  const input = await resources();
  const started = await created({ ...input, validFrom: day(-2) });
  expect((await modify(started, 'cancel')).status).toBe(409);
  expect((await modify(started, 'terminate', { lastValidDate: day(-1) })).status).toBe(409);
  expect((await modify(started, 'terminate', { lastValidDate: day(31) })).status).toBe(409);
  expect((await modify(started, 'terminate', { lastValidDate: day(0) })).status).toBe(204);
  const terminated = await detail(started.id);
  expect(terminated).toMatchObject({
    validFrom: day(-2),
    validTo: day(0),
    version: 2,
    cancelledAt: null,
  });
  const before = await stored(started.id),
    audit = await events(started.id);
  expect((await modify(terminated, 'terminate', { lastValidDate: day(0) })).status).toBe(204);
  expect(await stored(started.id)).toEqual(before);
  expect(await events(started.id)).toEqual(audit);
  const future = await created(input);
  expect((await modify(future, 'terminate', { lastValidDate: day(2) })).status).toBe(409);
  await db
    .update(t.observadores)
    .set({ activo: false })
    .where(eq(t.observadores.id, input.observerId));
  await db
    .update(t.modulosAtencion)
    .set({ activo: false })
    .where(eq(t.modulosAtencion.id, input.attentionModuleId));
  expect((await modify(future, 'cancel')).status).toBe(204);
  expect((await modify(future, 'cancel')).status).toBe(409);
  const cancelled = await detail(future.id),
    cancelledBefore = await stored(future.id),
    cancelledAudit = await events(future.id);
  expect((await modify(cancelled, 'cancel')).status).toBe(204);
  expect(await stored(future.id)).toEqual(cancelledBefore);
  expect(await events(future.id)).toEqual(cancelledAudit);
});

it('serializes empty-calendar creation across actors and rejects stale concurrent changes', async () => {
  const input = await resources();
  const attempts = await Promise.all([
    create(input),
    create(input, { cookie: accounts.ENLACE.cookie }),
  ]);
  expect(attempts.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
  const original = await attempts.find((r) => r.status === 201).json();
  const changes = await Promise.all([
    modify(original, 'change', { effectiveFrom: day(10), startTime: '08:00:00' }),
    modify(original, 'cancel', {}, { cookie: accounts.ENLACE.cookie }),
  ]);
  expect(changes.filter((r) => r.status === 409)).toHaveLength(1);
  expect(changes.filter((r) => [201, 204].includes(r.status))).toHaveLength(1);
  expect((await detail(original.id)).version).toBe(2);
});

it('does not schedule against a concurrently deactivated observer or module', async () => {
  for (const resource of ['observer', 'module']) {
    const input = await resources();
    const table = resource === 'observer' ? t.observadores : t.modulosAtencion;
    const id = resource === 'observer' ? input.observerId : input.attentionModuleId;
    const tableName = resource === 'observer' ? 'observadores' : 'modulos_atencion';
    const locked = Promise.withResolvers(),
      release = Promise.withResolvers();
    const deactivate = db.transaction(async (tx) => {
      await tx.select({ id: table.id }).from(table).where(eq(table.id, id)).for('update');
      locked.resolve();
      await release.promise;
      await tx.update(table).set({ activo: false }).where(eq(table.id, id));
    });
    let pending;
    try {
      await locked.promise;
      pending = create(input);
      await expect
        .poll(
          () =>
            rootSql(`SELECT COUNT(*) FROM performance_schema.data_lock_waits w
        JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.BLOCKING_ENGINE_LOCK_ID
        WHERE l.OBJECT_SCHEMA = '${database}' AND l.OBJECT_NAME = '${tableName}';`),
          { timeout: 10000 },
        )
        .not.toBe('0');
    } finally {
      release.resolve();
      await deactivate;
    }
    expect((await pending).status).toBe(409);
    expect(
      await db
        .select()
        .from(t.asignaciones)
        .where(eq(t.asignaciones.observadorId, input.observerId)),
    ).toEqual([]);
  }
});

it('rolls back the old period when inserting a replacement fails', async () => {
  const original = await created(await resources());
  const before = await stored(original.id),
    audit = await events(original.id);
  rootSql(`CREATE TRIGGER \`${database}\`.synthetic_replacement_failure BEFORE INSERT ON \`${database}\`.asignaciones
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic-replacement-error';`);
  try {
    for (const offset of [1, 10]) {
      const response = await modify(original, 'change', {
        effectiveFrom: day(offset),
        startTime: '08:00:00',
      });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('synthetic-replacement-error');
    }
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_replacement_failure;`);
  }
  expect(await stored(original.id)).toEqual(before);
  expect(await events(original.id)).toEqual(audit);
});

it('requires exact permissions on all six routes, rejects temporary credentials and enforces CSRF', async () => {
  const input = await resources(),
    assignment = await created(input);
  const routes = [
    ['', 'GET', undefined, codes[0]],
    [`/${assignment.id}`, 'GET', undefined, codes[0]],
    ['', 'POST', input, codes[1]],
    [
      `/${assignment.id}/change`,
      'POST',
      { effectiveFrom: day(2), startTime: '08:00:00', reason: 'Synthetic', expectedVersion: 1 },
      codes[2],
    ],
    [
      `/${assignment.id}/terminate`,
      'POST',
      { lastValidDate: day(2), reason: 'Synthetic', expectedVersion: 1 },
      codes[2],
    ],
    [`/${assignment.id}/cancel`, 'POST', { reason: 'Synthetic', expectedVersion: 1 }, codes[3]],
  ];
  for (const [path, method, body, code] of routes) {
    for (const [cookie, expected] of [
      ['', 401],
      [accounts.OBSERVADOR.cookie, 403],
      [accounts.temporary.cookie, 403],
    ])
      expect((await request(path, { method, body, cookie })).status).toBe(expected);
    for (const role of ['ADMIN', 'ENLACE']) {
      await db
        .delete(t.rolPermisos)
        .where(
          and(eq(t.rolPermisos.rolId, roles[role]), eq(t.rolPermisos.permisoId, permissions[code])),
        );
      try {
        expect((await request(path, { method, body, cookie: accounts[role].cookie })).status).toBe(
          403,
        );
      } finally {
        await db.insert(t.rolPermisos).values({ rolId: roles[role], permisoId: permissions[code] });
      }
    }
    if (method !== 'GET')
      expect((await request(path, { method, body, csrf: false })).status).toBe(403);
  }
  expect(await detail(assignment.id)).toEqual(assignment);
});

it('rolls back period closing, replacement and cancellation if auditing fails', async () => {
  const input = await resources(),
    original = await created(input);
  const started = await created({
    ...input,
    observerId: (await resources()).observerId,
    validFrom: day(-2),
  });
  const before = await stored(original.id),
    startedBefore = await stored(started.id),
    audit = await events(original.id);
  rootSql(`CREATE TRIGGER \`${database}\`.synthetic_assignment_audit_failure BEFORE INSERT ON \`${database}\`.auditoria
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic-private-audit-failure';`);
  try {
    for (const run of [
      () => modify(original, 'change', { effectiveFrom: day(10), startTime: '08:00:00' }),
      () => modify(original, 'change', { effectiveFrom: day(1), startTime: '08:00:00' }),
      () => modify(original, 'cancel'),
      () => modify(started, 'terminate', { lastValidDate: day(0) }),
    ]) {
      const response = await run();
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('synthetic-private-audit-failure');
    }
    const free = await resources();
    expect((await create(free)).status).toBe(500);
    expect(
      await db
        .select()
        .from(t.asignaciones)
        .where(eq(t.asignaciones.observadorId, free.observerId)),
    ).toEqual([]);
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_assignment_audit_failure;`);
  }
  expect(await stored(original.id)).toEqual(before);
  expect(await stored(started.id)).toEqual(startedBefore);
  expect(await events(original.id)).toEqual(audit);
  expect(
    await db.select().from(t.asignaciones).where(eq(t.asignaciones.observadorId, input.observerId)),
  ).toHaveLength(1);
});

it('revalidates actor authority after waiting for a concurrent revocation', async () => {
  const input = await resources();
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
          eq(t.rolPermisos.permisoId, permissions['assignments:create']),
        ),
      );
  });
  let pending;
  try {
    await locked.promise;
    pending = create(input);
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
        .values({ rolId: roles.ADMIN, permisoId: permissions['assignments:create'] });
    }
  }
  expect(
    await db.select().from(t.asignaciones).where(eq(t.asignaciones.observadorId, input.observerId)),
  ).toEqual([]);
});
