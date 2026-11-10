import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { v7 } from 'uuid';
import { afterAll, beforeAll, expect, it } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { AuthService, hashPassword } from '../dist/modules/auth/auth.service.js';
import { ObserversService } from '../dist/modules/observers/observers.service.js';
import * as t from '../dist/database/schema/index.js';
import { rootSql } from './helpers/mysql.mjs';

const suffix = randomBytes(8).toString('hex');
const database = `hhpaisanos_test_${suffix}`;
const runtimeUser = `hhp_test_${suffix}`;
const runtimePassword = randomBytes(24).toString('hex');
const password = 'Synthetic observer password 123';
const origin = 'http://localhost:5173';
const permissions = [
  'observers:read',
  'observers:create',
  'observers:update',
  'observers:change-status',
  'observers:link-account',
];
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
let app, db, baseUrl, admin, enlace, observer, temporary;
let databaseCreated = false,
  userCreated = false;
const roleIds = {};

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
  const permissionIds = {};
  for (const code of permissions) {
    permissionIds[code] = v7();
    await db.insert(t.permisos).values({ id: permissionIds[code], codigo: code });
  }
  for (const code of ['ADMIN', 'ENLACE', 'OBSERVADOR']) {
    roleIds[code] = v7();
    await db
      .insert(t.roles)
      .values({ id: roleIds[code], codigo: code, nombre: code, activo: true });
    if (code !== 'OBSERVADOR')
      for (const permission of permissions) {
        await db
          .insert(t.rolPermisos)
          .values({ rolId: roleIds[code], permisoId: permissionIds[permission] });
      }
  }
  admin = await account('ADMIN');
  enlace = await account('ENLACE');
  observer = await account('OBSERVADOR');
  temporary = await account('ADMIN', true);
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

async function account(role, mustChangePassword = false) {
  const id = v7(),
    username = `synthetic-${v7().slice(-12)}`;
  await db.insert(t.usuarios).values({
    id,
    nombreUsuario: username,
    nombreCompleto: 'Synthetic person',
    rolId: roleIds[role],
    passwordHash: await hashPassword(password),
    activo: true,
    debeCambiarPassword: mustChangePassword,
    intentosFallidos: 0,
  });
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'X-HHP-CSRF': '1' },
    body: JSON.stringify({ username, password }),
  });
  expect(response.status).toBe(200);
  return { id, username, cookie: response.headers.get('set-cookie').split(';')[0] };
}
function request(path = '', { method = 'GET', cookie = admin.cookie, body, csrf = true } = {}) {
  return fetch(`${baseUrl}/api/observers${path}`, {
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
const create = (body = { firstNames: 'Synthetic', lastNames: 'Observer' }, options = {}) =>
  request('', { method: 'POST', body, ...options });
const events = (id) => db.select().from(t.auditoria).where(eq(t.auditoria.entidadId, id));

it('creates independent active profiles, preserves Unicode and returns only the approved projection', async () => {
  const response = await create(
    { firstNames: '  María  José ', lastNames: 'Álvarez', phone: null },
    { cookie: enlace.cookie },
  );
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const profile = await response.json();
  expect(profile).toEqual({
    id: expect.any(String),
    firstNames: '  María  José ',
    lastNames: 'Álvarez',
    phone: null,
    userId: null,
    active: true,
    createdAt: expect.stringMatching(/\.\d{6}$/),
    updatedAt: expect.any(String),
  });
  expect(await (await request(`/${profile.id}`)).json()).toEqual(profile);
  const [event] = await events(profile.id);
  expect(event).toMatchObject({
    usuarioId: enlace.id,
    accion: 'observers.created',
    tipoEntidad: 'observadores',
    canal: 'web',
    valoresNuevos: { active: true },
  });
  const [session] = await db.select().from(t.sesiones).where(eq(t.sesiones.id, event.sesionId));
  expect(session.usuarioId).toBe(enlace.id);
  // Names and phones are not identity keys: duplicate people must not be invented as conflicts.
  expect(
    (await create({ firstNames: profile.firstNames, lastNames: profile.lastNames })).status,
  ).toBe(201);
});

it('filters literal names, activity and account presence with stable pagination', async () => {
  for (const lastNames of ['First', 'Second'])
    await create({ firstNames: 'Literal %_!', lastNames });
  const first = await (await request('?search=Literal%20%25_%21&pageSize=1')).json();
  const second = await (await request('?search=Literal%20%25_%21&pageSize=1&page=2')).json();
  expect(first).toMatchObject({ total: 2, page: 1, pageSize: 1 });
  expect(second.items).toHaveLength(1);
  expect(second.items[0].id).not.toBe(first.items[0].id);
  await request(`/${first.items[0].id}/status`, {
    method: 'PATCH',
    body: { active: false, reason: 'Synthetic inactive' },
  });
  expect(
    await (await request('?search=Literal%20%25_%21&active=false&linked=false')).json(),
  ).toMatchObject({
    total: 1,
    items: [{ ...first.items[0], active: false, updatedAt: expect.any(String) }],
  });
  expect(await (await request('?linked=true')).json()).toMatchObject({ total: 0 });
});

it('updates only allowed fields, clears phones explicitly and skips identical writes and audit events', async () => {
  const profile = await (
    await create({ firstNames: 'Before', lastNames: 'Stable', phone: '+52 123' })
  ).json();
  expect(
    (
      await request(`/${profile.id}`, {
        method: 'PATCH',
        body: { firstNames: 'After', phone: null, reason: 'Synthetic correction' },
        cookie: enlace.cookie,
      })
    ).status,
  ).toBe(204);
  const updated = await (await request(`/${profile.id}`)).json();
  expect(updated).toMatchObject({
    firstNames: 'After',
    lastNames: 'Stable',
    phone: null,
    active: true,
  });
  const before = await events(profile.id);
  expect(before.find((event) => event.accion === 'observers.updated')).toMatchObject({
    motivo: 'Synthetic correction',
    valoresNuevos: { fields: ['firstNames', 'phone'] },
  });
  expect(JSON.stringify(before)).not.toContain('+52 123');
  expect(JSON.stringify(before)).not.toContain('Before');
  await request(`/${profile.id}`, {
    method: 'PATCH',
    body: { firstNames: 'After', phone: null, reason: 'Repeat' },
  });
  await request(`/${profile.id}/status`, {
    method: 'PATCH',
    body: { active: true, reason: 'Repeat' },
  });
  expect(await events(profile.id)).toEqual(before);
  expect(await (await request(`/${profile.id}`)).json()).toEqual(updated);
  await Promise.all([
    request(`/${profile.id}`, {
      method: 'PATCH',
      body: { firstNames: 'Concurrent', reason: 'Name correction' },
    }),
    request(`/${profile.id}`, {
      method: 'PATCH',
      body: { lastNames: 'Concurrent', reason: 'Surname correction' },
    }),
  ]);
  expect(await (await request(`/${profile.id}`)).json()).toMatchObject({
    firstNames: 'Concurrent',
    lastNames: 'Concurrent',
  });
});

it('preserves linked accounts, sessions and historical assignments through profile changes', async () => {
  const profile = await (await create()).json();
  // Linking is fixture-only; no HTTP linking functionality is exposed.
  await db
    .update(t.observadores)
    .set({ usuarioId: observer.id })
    .where(eq(t.observadores.id, profile.id));
  const accountBefore = await db.select().from(t.usuarios).where(eq(t.usuarios.id, observer.id));
  const sessionsBefore = await db
    .select()
    .from(t.sesiones)
    .where(eq(t.sesiones.usuarioId, observer.id));
  const [{ id: operativeId }] = await db
    .insert(t.operativos)
    .values({
      nombre: 'Synthetic history',
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-31',
      estado: 'borrador',
    })
    .$returningId();
  const [{ id: moduleId }] = await db
    .insert(t.modulosAtencion)
    .values({ nombre: 'Synthetic module', municipio: 'Synthetic municipality', activo: true })
    .$returningId();
  const [{ id: assignmentId }] = await db
    .insert(t.asignaciones)
    .values({
      operativoId: operativeId,
      observadorId: profile.id,
      moduloId: moduleId,
      vigenteDesde: '2026-12-01',
      vigenteHasta: '2026-12-31',
      horaInicio: '09:00:00',
      horaFin: '10:00:00',
      creadoPor: admin.id,
    })
    .$returningId();
  const assignmentsBefore = await db
    .select()
    .from(t.asignaciones)
    .where(eq(t.asignaciones.id, assignmentId));
  for (const active of [false, true])
    expect(
      (
        await request(`/${profile.id}/status`, {
          method: 'PATCH',
          body: { active, reason: 'Synthetic status' },
        })
      ).status,
    ).toBe(204);
  expect(await db.select().from(t.usuarios).where(eq(t.usuarios.id, observer.id))).toEqual(
    accountBefore,
  );
  expect(await db.select().from(t.sesiones).where(eq(t.sesiones.usuarioId, observer.id))).toEqual(
    sessionsBefore,
  );
  expect(await db.select().from(t.asignaciones).where(eq(t.asignaciones.id, assignmentId))).toEqual(
    assignmentsBefore,
  );
  expect(await (await request(`/${profile.id}`)).json()).toMatchObject({
    userId: observer.id,
    active: true,
  });
  expect((await events(profile.id)).map((event) => event.accion)).toEqual([
    'observers.created',
    'observers.deactivated',
    'observers.activated',
  ]);
  expect((await (await request('?linked=true')).json()).items.map((item) => item.id)).toContain(
    profile.id,
  );
});

it('rejects invalid input and unsupported operations without modifying profiles', async () => {
  const profile = await (await create()).json();
  for (const body of [
    {},
    { firstNames: ' ', lastNames: 'Valid' },
    { firstNames: null, lastNames: 'Valid' },
    { firstNames: 'x'.repeat(101), lastNames: 'Valid' },
    { firstNames: ['Invalid'], lastNames: 'Valid' },
    { firstNames: 'Valid', lastNames: 'Valid', phone: 'x'.repeat(21) },
    { firstNames: 'Valid', lastNames: 'Valid', phone: '' },
    ...['active', 'userId', 'id'].map((field) => ({
      firstNames: 'Valid',
      lastNames: 'Valid',
      [field]: field === 'active' ? false : v7(),
    })),
  ])
    expect((await create(body)).status).toBe(400);
  for (const body of [
    { reason: 'Empty patch' },
    { firstNames: null, reason: 'Invalid' },
    { phone: false, reason: 'Invalid' },
    { firstNames: 'Changed' },
    { firstNames: 'Changed', reason: ' ' },
    { active: false, reason: 'Invalid' },
    { userId: v7(), reason: 'Invalid' },
  ])
    expect((await request(`/${profile.id}`, { method: 'PATCH', body })).status).toBe(400);
  for (const body of [
    { active: 'false', reason: 'Invalid' },
    { active: null, reason: 'Invalid' },
    { active: false },
  ])
    expect((await request(`/${profile.id}/status`, { method: 'PATCH', body })).status).toBe(400);
  for (const query of [
    '?active=1',
    '?linked=0',
    '?active=true&active=false',
    '?page=0',
    '?pageSize=101',
    '?page=1.5',
    '?search=',
    '?extra=1',
  ])
    expect((await request(query)).status).toBe(400);
  expect((await request('/invalid')).status).toBe(400);
  expect((await request(`/${v7()}`)).status).toBe(404);
  expect(
    (await request(`/${v7()}`, { method: 'PATCH', body: { phone: null, reason: 'Missing' } }))
      .status,
  ).toBe(404);
  expect((await request(`/${profile.id}`, { method: 'DELETE', body: {} })).status).toBe(404);
  expect(
    (
      await request(`/${profile.id}/account`, {
        method: 'PUT',
        body: { userId: observer.id, reason: 'Unsupported' },
      })
    ).status,
  ).toBe(400);
  expect(await (await request(`/${profile.id}`)).json()).toEqual(profile);
  expect(await events(profile.id)).toHaveLength(1);
});

const linkInput = (userId) => ({
  userId,
  verificationMethod: 'supervised_administrative',
  reason: 'Synthetic supervised verification',
});
const link = (id, userId, options = {}) =>
  request(`/${id}/account`, { method: 'PUT', body: linkInput(userId), ...options });

it('links verified pairs for ADMIN and ENLACE, revokes sessions and preserves idempotency and assignments', async () => {
  for (const operator of [admin, enlace]) {
    const target = await account('OBSERVADOR');
    const profile = await (await create()).json();
    const [{ id: operativeId }] = await db
      .insert(t.operativos)
      .values({
        nombre: `Link history ${profile.id}`,
        fechaInicio: '2026-12-01',
        fechaFin: '2026-12-31',
        estado: 'borrador',
      })
      .$returningId();
    const [{ id: moduleId }] = await db
      .insert(t.modulosAtencion)
      .values({ nombre: 'Link module', municipio: 'Synthetic', activo: true })
      .$returningId();
    await db.insert(t.asignaciones).values({
      operativoId: operativeId,
      observadorId: profile.id,
      moduloId: moduleId,
      vigenteDesde: '2026-12-01',
      vigenteHasta: '2026-12-31',
      horaInicio: '09:00:00',
      horaFin: '17:00:00',
      creadoPor: admin.id,
    });
    const history = await db
      .select()
      .from(t.asignaciones)
      .where(eq(t.asignaciones.observadorId, profile.id));
    const lookup = await request(
      `/linkable-account?username=${encodeURIComponent(target.username)}`,
      { cookie: operator.cookie },
    );
    expect(lookup.status).toBe(200);
    expect(await lookup.json()).toEqual({
      id: target.id,
      username: target.username,
      fullName: 'Synthetic person',
    });
    expect((await link(profile.id, target.id, { cookie: operator.cookie })).status).toBe(204);
    const [event] = (await events(profile.id)).filter(
      (e) => e.accion === 'observers.account.linked',
    );
    expect(event).toMatchObject({
      usuarioId: operator.id,
      sesionId: expect.any(String),
      valoresAnteriores: { userId: null },
      valoresNuevos: { userId: target.id, verificationMethod: 'supervised_administrative' },
      motivo: linkInput(target.id).reason,
    });
    expect(
      (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: target.cookie } })).status,
    ).toBe(401);
    const before = await events(profile.id);
    const sessions = await db.select().from(t.sesiones).where(eq(t.sesiones.usuarioId, target.id));
    expect(
      sessions.every((s) => s.revocadaEn && s.motivoRevocacion === 'observer_account_linked'),
    ).toBe(true);
    expect((await link(profile.id, target.id, { cookie: operator.cookie })).status).toBe(204);
    expect(await events(profile.id)).toEqual(before);
    expect(await db.select().from(t.sesiones).where(eq(t.sesiones.usuarioId, target.id))).toEqual(
      sessions,
    );
    expect(
      await db.select().from(t.asignaciones).where(eq(t.asignaciones.observadorId, profile.id)),
    ).toEqual(history);
    expect((await request(`/linkable-account?username=${target.username}`)).status).toBe(404);
  }
});

it('rejects ineligible accounts/profiles, conflicting and legacy links without certifying them', async () => {
  for (const change of [
    { activo: false },
    { debeCambiarPassword: true },
    { bloqueadoHasta: '2099-01-01 00:00:00.000000' },
    { rolId: roleIds.ENLACE },
    { rolId: roleIds.ADMIN },
  ]) {
    const target = await account('OBSERVADOR');
    await db.update(t.usuarios).set(change).where(eq(t.usuarios.id, target.id));
    const profile = await (await create()).json();
    expect((await link(profile.id, target.id)).status).toBe(409);
    expect((await request(`/linkable-account?username=${target.username}`)).status).toBe(404);
    expect(await events(profile.id)).toHaveLength(1);
  }
  const target = await account('OBSERVADOR');
  const profile = await (await create()).json();
  await db.update(t.roles).set({ activo: false }).where(eq(t.roles.id, roleIds.OBSERVADOR));
  try {
    expect((await link(profile.id, target.id)).status).toBe(409);
  } finally {
    await db.update(t.roles).set({ activo: true }).where(eq(t.roles.id, roleIds.OBSERVADOR));
  }
  await db.update(t.observadores).set({ activo: false }).where(eq(t.observadores.id, profile.id));
  expect((await link(profile.id, target.id)).status).toBe(409);
  await db
    .update(t.observadores)
    .set({ activo: true, usuarioId: target.id })
    .where(eq(t.observadores.id, profile.id));
  const before = await events(profile.id);
  expect((await link(profile.id, target.id)).status).toBe(409);
  expect((await link(profile.id, (await account('OBSERVADOR')).id)).status).toBe(409);
  expect((await link((await (await create()).json()).id, target.id)).status).toBe(409);
  expect(await events(profile.id)).toEqual(before);
  expect((await link(v7(), target.id)).status).toBe(404);
  expect((await link(profile.id, v7())).status).toBe(404);
});

it('serializes account and profile linking across different authorized actors', async () => {
  for (const sameAccount of [true, false]) {
    const targets = [await account('OBSERVADOR'), await account('OBSERVADOR')];
    const profiles = [await (await create()).json(), await (await create()).json()];
    const results = await Promise.all([
      link(profiles[0].id, targets[0].id),
      link(profiles[sameAccount ? 1 : 0].id, targets[sameAccount ? 0 : 1].id, {
        cookie: enlace.cookie,
      }),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([204, 409]);
    const audits = [...(await events(profiles[0].id)), ...(await events(profiles[1].id))].filter(
      (e) => e.accion === 'observers.account.linked',
    );
    expect(audits).toHaveLength(1);
  }
});

it('rechecks target eligibility after waiting for account and profile changes', async () => {
  for (const change of ['account-status', 'role', 'password-reset', 'profile-status']) {
    const target = await account('OBSERVADOR');
    const profile = await (await create()).json();
    const table = change === 'profile-status' ? t.observadores : t.usuarios;
    const id = change === 'profile-status' ? profile.id : target.id;
    const tableName = change === 'profile-status' ? 'observadores' : 'usuarios';
    const locked = Promise.withResolvers(),
      release = Promise.withResolvers();
    const mutation = db.transaction(async (tx) => {
      await tx.select({ id: table.id }).from(table).where(eq(table.id, id)).for('update');
      locked.resolve();
      await release.promise;
      if (change === 'role')
        await tx.update(t.usuarios).set({ rolId: roleIds.ENLACE }).where(eq(t.usuarios.id, id));
      else if (change === 'password-reset')
        await tx.update(t.usuarios).set({ debeCambiarPassword: true }).where(eq(t.usuarios.id, id));
      else await tx.update(table).set({ activo: false }).where(eq(table.id, id));
    });
    let pending;
    try {
      await locked.promise;
      pending = link(profile.id, target.id);
      await expect
        .poll(
          () =>
            rootSql(
              `SELECT COUNT(*) FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.BLOCKING_ENGINE_LOCK_ID WHERE l.OBJECT_SCHEMA = '${database}' AND l.OBJECT_NAME = '${tableName}';`,
            ),
          { timeout: 10000 },
        )
        .not.toBe('0');
    } finally {
      release.resolve();
      await mutation;
    }
    expect((await pending).status).toBe(409);
    expect((await (await request(`/${profile.id}`)).json()).userId).toBeNull();
    expect(
      (await events(profile.id)).filter((e) => e.accion === 'observers.account.linked'),
    ).toEqual([]);
  }
});

it('rejects revoked actor sessions transactionally and makes verified duplicate requests idempotent', async () => {
  const actor = await account('ENLACE');
  const target = await account('OBSERVADOR');
  const profile = await (await create()).json();
  const auth = app.get(AuthService);
  const context = await auth.authenticate({ headers: { cookie: actor.cookie } });
  await auth.logout({ headers: { cookie: actor.cookie } });
  await expect(
    app.get(ObserversService).linkAccount(context, profile.id, linkInput(target.id)),
  ).rejects.toMatchObject({ status: 401 });
  const attempts = await Promise.all([
    link(profile.id, target.id),
    link(profile.id, target.id, { cookie: enlace.cookie }),
  ]);
  expect(attempts.map((r) => r.status)).toEqual([204, 204]);
  expect(
    (await events(profile.id)).filter((e) => e.accion === 'observers.account.linked'),
  ).toHaveLength(1);
  const before = await (await request(`/${profile.id}`)).json();
  const audits = await events(profile.id);
  await db.update(t.usuarios).set({ activo: false }).where(eq(t.usuarios.id, target.id));
  expect((await link(profile.id, target.id)).status).toBe(204);
  expect(await (await request(`/${profile.id}`)).json()).toEqual(before);
  expect(await events(profile.id)).toEqual(audits);
});

it('validates linking DTOs and exact lookups and preserves Users administration boundaries', async () => {
  const target = await account('OBSERVADOR');
  const profile = await (await create()).json();
  for (const body of [
    {},
    { ...linkInput(target.id), userId: 'bad' },
    { ...linkInput(target.id), verificationMethod: 'name_match' },
    { ...linkInput(target.id), reason: ' ' },
    { ...linkInput(target.id), reason: 'x'.repeat(501) },
    { ...linkInput(target.id), password: 'never accepted' },
  ])
    expect((await request(`/${profile.id}/account`, { method: 'PUT', body })).status).toBe(400);
  for (const query of ['', '?username=', '?username=x&extra=1', '?username=x&username=y'])
    expect((await request(`/linkable-account${query}`)).status).toBe(400);
  expect(
    (await request(`/linkable-account?username=${target.username.toUpperCase()}`)).status,
  ).toBe(404);
  expect((await fetch(`${baseUrl}/api/users`, { headers: { Cookie: enlace.cookie } })).status).toBe(
    403,
  );
  for (const cookie of ['', observer.cookie, temporary.cookie]) {
    const expected = cookie ? 403 : 401;
    expect((await link(profile.id, target.id, { cookie })).status).toBe(expected);
    expect(
      (await request(`/linkable-account?username=${target.username}`, { cookie })).status,
    ).toBe(expected);
  }
  expect((await link(profile.id, target.id, { csrf: false })).status).toBe(403);
  const [permission] = await db
    .select()
    .from(t.permisos)
    .where(eq(t.permisos.codigo, 'observers:link-account'));
  const grants = await db
    .select()
    .from(t.rolPermisos)
    .where(eq(t.rolPermisos.permisoId, permission.id));
  const context = await app.get(AuthService).authenticate({ headers: { cookie: admin.cookie } });
  await db.delete(t.rolPermisos).where(eq(t.rolPermisos.permisoId, permission.id));
  try {
    for (const cookie of [admin.cookie, enlace.cookie]) {
      expect((await link(profile.id, target.id, { cookie })).status).toBe(403);
      expect(
        (await request(`/linkable-account?username=${target.username}`, { cookie })).status,
      ).toBe(403);
    }
    await expect(
      app.get(ObserversService).linkAccount(context, profile.id, linkInput(target.id)),
    ).rejects.toMatchObject({ status: 403 });
  } finally {
    await db.insert(t.rolPermisos).values(grants);
  }
});

it('rolls back linking and session revocation when audit insertion fails', async () => {
  const target = await account('OBSERVADOR');
  const profile = await (await create()).json();
  const sessions = await db.select().from(t.sesiones).where(eq(t.sesiones.usuarioId, target.id));
  const before = await events(profile.id);
  rootSql(
    `DELIMITER $$
CREATE TRIGGER \`${database}\`.synthetic_link_failure BEFORE INSERT ON \`${database}\`.auditoria FOR EACH ROW BEGIN IF NEW.accion = 'observers.account.linked' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic-secret-error'; END IF; END$$
DELIMITER ;`,
  );
  try {
    const response = await link(profile.id, target.id);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('synthetic-secret-error');
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_link_failure;`);
  }
  expect(await (await request(`/${profile.id}`)).json()).toEqual(profile);
  expect(await db.select().from(t.sesiones).where(eq(t.sesiones.usuarioId, target.id))).toEqual(
    sessions,
  );
  expect(await events(profile.id)).toEqual(before);
});

it('requires each explicit permission, valid sessions, changed passwords and CSRF without an ADMIN bypass', async () => {
  const profile = await (await create()).json();
  const operations = [
    ['', { method: 'GET' }, 'observers:read'],
    [`/${profile.id}`, { method: 'GET' }, 'observers:read'],
    [
      '',
      { method: 'POST', body: { firstNames: 'Denied', lastNames: 'Denied' } },
      'observers:create',
    ],
    [
      `/${profile.id}`,
      { method: 'PATCH', body: { phone: null, reason: 'Denied' } },
      'observers:update',
    ],
    [
      `/${profile.id}/status`,
      { method: 'PATCH', body: { active: false, reason: 'Denied' } },
      'observers:change-status',
    ],
  ];
  for (const [path, options, permission] of operations) {
    for (const [cookie, status] of [
      ['', 401],
      [observer.cookie, 403],
      [temporary.cookie, 403],
    ])
      expect((await request(path, { ...options, cookie })).status).toBe(status);
    const [p] = await db.select().from(t.permisos).where(eq(t.permisos.codigo, permission));
    const grants = await db.select().from(t.rolPermisos).where(eq(t.rolPermisos.permisoId, p.id));
    await db.delete(t.rolPermisos).where(eq(t.rolPermisos.permisoId, p.id));
    try {
      expect((await request(path, options)).status).toBe(403);
    } finally {
      await db.insert(t.rolPermisos).values(grants);
    }
    if (options.method !== 'GET')
      expect((await request(path, { ...options, csrf: false })).status).toBe(403);
  }
  // Exercise the transactional security boundary with a once-valid context after revocation.
  const auth = app.get(AuthService);
  const context = await auth.authenticate({ headers: { cookie: enlace.cookie } });
  const [p] = await db.select().from(t.permisos).where(eq(t.permisos.codigo, 'observers:update'));
  const grants = await db.select().from(t.rolPermisos).where(eq(t.rolPermisos.permisoId, p.id));
  await db.delete(t.rolPermisos).where(eq(t.rolPermisos.permisoId, p.id));
  try {
    await expect(
      app
        .get(ObserversService)
        .update(context, profile.id, { firstNames: 'Forbidden', reason: 'Stale authority' }),
    ).rejects.toMatchObject({ status: 403 });
  } finally {
    await db.insert(t.rolPermisos).values(grants);
  }
  await auth.logout({ headers: { cookie: enlace.cookie } });
  await expect(
    app
      .get(ObserversService)
      .changeStatus(context, profile.id, { active: false, reason: 'Revoked session' }),
  ).rejects.toMatchObject({ status: 401 });
  expect(await (await request(`/${profile.id}`)).json()).toEqual(profile);
});

it('rolls back creation, edits and status together with failed audit writes', async () => {
  const profile = await (await create()).json();
  const before = await events(profile.id);
  const profilesBefore = await db.select().from(t.observadores);
  rootSql(
    `CREATE TRIGGER \`${database}\`.synthetic_audit_failure BEFORE INSERT ON \`${database}\`.auditoria FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic-secret-error';`,
  );
  try {
    for (const response of [
      await create(),
      await request(`/${profile.id}`, {
        method: 'PATCH',
        body: { phone: '123', reason: 'Rollback' },
      }),
      await request(`/${profile.id}/status`, {
        method: 'PATCH',
        body: { active: false, reason: 'Rollback' },
      }),
    ]) {
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('synthetic-secret-error');
    }
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_audit_failure;`);
  }
  expect(await db.select().from(t.observadores)).toEqual(profilesBefore);
  expect(await events(profile.id)).toEqual(before);
});
