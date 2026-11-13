import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { v7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { hashPassword } from '../dist/modules/auth/auth.service.js';
import { installRequestTimestamp } from '../dist/request-timestamp.js';
import * as t from '../dist/database/schema/index.js';
import { provisionUsersPermissions } from '../tools/provision-users-permissions.mjs';
import { rootSql } from './helpers/mysql.mjs';

const suffix = randomBytes(8).toString('hex');
const database = `hhpaisanos_test_${suffix}`,
  runtimeUser = `hhp_test_${suffix}`;
const runtimePassword = randomBytes(24).toString('hex');
const password = 'Synthetic integrated attendance password 123';
const origin = 'http://localhost:5173';
const date = '2030-01-15';
const gps = { latitude: 16.85, longitude: -99.9, accuracy: 3 };
const reason = 'Synthetic integrated validation';
const roles = {};
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
  admin,
  enlace,
  databaseCreated = false,
  userCreated = false;

// Only Date is faked: HTTP, MySQL and test timeouts keep their real timers.
function at(time) {
  vi.setSystemTime(new Date(`${date}T${time}-06:00`));
}
const instant = (time, civilDate = date) =>
  new Date(`${civilDate}T${time}-06:00`).toISOString().replace('.000Z', '.000000Z');
function request(path, { method = 'GET', cookie = admin?.cookie, body, key, csrf = true } = {}) {
  return fetch(`${baseUrl}/api/${path}`, {
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
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(path, body, status = 201, options = {}) {
  const response = await request(path, { method: 'POST', body, ...options });
  expect(response.status, `${path}: ${await response.clone().text()}`).toBe(status);
  return status === 204 ? undefined : response.json();
}
async function login(username, suppliedPassword = password) {
  const response = await request('auth/login', {
    method: 'POST',
    cookie: null,
    body: { username, password: suppliedPassword },
  });
  expect(response.status).toBe(200);
  return response.headers.get('set-cookie').split(';')[0];
}
async function account(role) {
  const username = `synthetic-${v7()}`;
  const created = await json('users', {
    username,
    fullName: 'Synthetic attendance user',
    roleId: roles[role],
  });
  const temporaryCookie = await login(username, created.temporaryPassword);
  expect((await request('attendance/me/today', { cookie: temporaryCookie })).status).toBe(403);
  await json(
    'auth/change-password',
    { currentPassword: created.temporaryPassword, newPassword: password },
    204,
    { cookie: temporaryCookie },
  );
  expect((await request('auth/me', { cookie: temporaryCookie })).status).toBe(401);
  return { id: created.id, username, cookie: await login(username) };
}
async function startApp() {
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  installRequestTimestamp(app);
  await app.listen(0, 'localhost');
  baseUrl = await app.getUrl();
  db = app.get(DatabaseService).db;
}
async function fixture() {
  const operative = await json('operatives', {
    name: `Synthetic ${v7()}`,
    startDate: '2030-01-01',
    endDate: '2030-01-31',
  });
  await json(`operatives/${operative.id}/activate`, { arrivalToleranceMinutes: 7, reason }, 204);
  const observer = await json('observers', { firstNames: 'Synthetic', lastNames: 'Observer' });
  const user = await account('OBSERVADOR');
  expect((await request('attendance/me/today', { cookie: user.cookie })).status).toBe(403);
  const preLinkCookie = user.cookie;
  const linked = await request(`observers/${observer.id}/account`, {
    method: 'PUT',
    body: { userId: user.id, verificationMethod: 'supervised_administrative', reason },
  });
  expect(linked.status).toBe(204);
  expect((await request('attendance/me/today', { cookie: preLinkCookie })).status).toBe(401);
  user.cookie = await login(user.username);
  const module = await json('attention-modules', {
    name: `Synthetic ${v7()}`,
    municipality: 'Synthetic Guerrero',
  });
  const assignment = await json('assignments', {
    operativeId: operative.id,
    observerId: observer.id,
    attentionModuleId: module.id,
    validFrom: '2030-01-01',
    validTo: '2030-01-31',
    startTime: '09:00:00',
    endTime: '17:00:00',
  });
  return {
    ...user,
    observerId: observer.id,
    operativeId: operative.id,
    assignmentId: assignment.id,
  };
}
function capture(f, type = 'check-in', { key = v7(), location = gps, ...options } = {}) {
  return request(`attendance/me/${type}`, {
    method: 'POST',
    cookie: f.cookie,
    key,
    body: { assignmentId: f.assignmentId, expectedDate: date, location },
    ...options,
  });
}
const decision = (extra = {}) => ({ expectedVersion: 1, reason, ...extra });
const mark = async (id) =>
  (await db.select().from(t.registrosAsistencia).where(eq(t.registrosAsistencia.id, id)))[0];
const audits = () => db.select().from(t.auditoria).orderBy(t.auditoria.id);

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
    connectionLimit: 8,
  });
  try {
    await setup.onModuleInit();
    await migrate(setup.db, { migrationsFolder: './drizzle' });
  } finally {
    await setup.onModuleDestroy();
  }
  await startApp();
  // Only the deployment prerequisites lack a public creation API. All workflow data below uses HTTP.
  for (const code of ['ADMIN', 'ENLACE', 'OBSERVADOR']) {
    roles[code] = v7();
    await db.insert(t.roles).values({ id: roles[code], codigo: code, nombre: code, activo: true });
  }
  const id = v7(),
    username = `synthetic-admin-${suffix}`;
  await db.insert(t.usuarios).values({
    id,
    rolId: roles.ADMIN,
    nombreUsuario: username,
    nombreCompleto: 'Synthetic admin',
    passwordHash: await hashPassword(password),
    activo: true,
    debeCambiarPassword: false,
    intentosFallidos: 0,
  });
  await provisionUsersPermissions(db, id, reason, true);
  admin = { id, cookie: await login(username) };
  enlace = await account('ENLACE');
  vi.useFakeTimers({ toFake: ['Date'] });
  at('08:00:00');
}, 60000);
beforeEach(async () => {
  at('08:00:00');
  await app.close();
  await startApp();
});
afterAll(async () => {
  vi.useRealTimers();
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

it('authenticates, activates, onboards and links through public APIs before automatically accepting the configured schedule boundaries', async () => {
  const f = await fixture();
  const context = await (await request('attendance/me/today', { cookie: f.cookie })).json();
  expect(context).toMatchObject({
    date,
    timeZone: 'America/Mexico_City',
    assignments: [
      { assignmentId: f.assignmentId, arrivalToleranceMinutes: 7, completeness: 'none' },
    ],
  });
  at('09:07:00');
  const entryResponse = await capture(f);
  expect(entryResponse.status).toBe(201);
  const entry = await entryResponse.json();
  expect(entry.state).toBe('accepted_automatic');
  at('17:00:00');
  const exitResponse = await capture(f, 'check-out');
  expect(exitResponse.status).toBe(201);
  const exit = await exitResponse.json();
  expect(exit.state).toBe('accepted_automatic');
  const own = await (await request('attendance/me', { cookie: f.cookie })).json();
  expect(own).toMatchObject({
    total: 1,
    items: [
      {
        completeness: 'complete',
        checkIn: { id: entry.attendanceId, officialTimestamp: instant('09:07:00'), anomalies: [] },
        checkOut: { id: exit.attendanceId, officialTimestamp: instant('17:00:00'), anomalies: [] },
      },
    ],
  });
  expect(JSON.stringify(own)).not.toMatch(/latitude|longitude|receipt|passwordHash/);
  for (const actor of [admin, enlace]) {
    const list = await request(`attendance?observerId=${f.observerId}`, { cookie: actor.cookie });
    expect(list.status).toBe(200);
    expect((await list.json()).total).toBe(2);
    expect((await request('attendance/me', { cookie: actor.cookie })).status).toBe(403);
  }
  const evidence = (await audits()).filter(
    (a) => a.accion === 'observers.account.linked' && a.entidadId === f.observerId,
  );
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({
    usuarioId: admin.id,
    valoresNuevos: { userId: f.id, verificationMethod: 'supervised_administrative' },
  });
});

it('keeps simultaneous incidents, administrative decisions, corrected evidence and terminal replay consistent across modules', async () => {
  const f = await fixture(),
    key = v7();
  at('09:07:00.001');
  const entry = await (await capture(f, 'check-in', { key })).json();
  expect(entry.state).toBe('pending_review');
  const original = await mark(entry.attendanceId);
  at('16:59:59.999');
  const exit = await (
    await capture(f, 'check-out', { location: { missingReason: 'permission_denied' } })
  ).json();
  expect(exit.state).toBe('pending_review');
  const detail = await (await request(`attendance/${exit.attendanceId}`)).json();
  expect(detail.anomalies).toEqual(['early_departure', 'missing_location']);
  await json(`attendance/${entry.attendanceId}/review`, decision({ decision: 'accept' }), 200);
  await json(`attendance/${exit.attendanceId}/review`, decision({ decision: 'reject' }), 200, {
    cookie: enlace.cookie,
  });
  const corrected = await json(
    `attendance/${entry.attendanceId}/corrections`,
    decision({ officialTimestamp: instant('09:00:00') }),
  );
  const current = await mark(corrected.id);
  expect(current).toMatchObject({
    version: 2,
    estado: 'pending_review',
    revisadoPor: null,
    revisadoEn: null,
    latitud: original.latitud,
    longitud: original.longitud,
    precisionM: original.precisionM,
    registradoPor: f.id,
    anteriorId: original.id,
  });
  expect(await mark(original.id)).toMatchObject({
    registradoEn: original.registradoEn,
    latitud: original.latitud,
    vigente: null,
  });
  await json(
    `attendance/${corrected.id}/review`,
    decision({ expectedVersion: 2, decision: 'accept' }),
    200,
    { cookie: enlace.cookie },
  );
  await json(`attendance/${corrected.id}/annul`, decision({ expectedVersion: 2 }), 200);
  const beforeReplay = await audits();
  expect(await (await capture(f, 'check-in', { key })).json()).toEqual(entry);
  expect(await audits()).toEqual(beforeReplay);
  const history = await (await request(`attendance/${original.id}/history`)).json();
  expect(history).toMatchObject({
    total: 2,
    items: [
      { id: original.id, current: false },
      { id: corrected.id, reviewStatus: 'annulled' },
    ],
  });
  expect(JSON.stringify(history)).not.toMatch(/latitude|longitude|receipt/);
  const personal = await (await request('attendance/me/today', { cookie: f.cookie })).json();
  expect(personal.assignments[0]).toMatchObject({
    checkIn: { id: corrected.id, reviewStatus: 'annulled' },
    checkOut: { reviewStatus: 'rejected' },
  });
  expect((await capture(f)).status).toBe(409);
  // Historical backfill uses the same API-created period and never invents coordinates.
  const manualBody = {
    observerId: f.observerId,
    assignmentId: f.assignmentId,
    date: '2030-01-14',
    type: 'salida',
    officialTimestamp: instant('17:00:00', '2030-01-14'),
    missingLocationReason: 'unsupported',
    reason,
  };
  const manual = await json('attendance/manual', manualBody, 201, { cookie: enlace.cookie });
  expect(await mark(manual.id)).toMatchObject({
    canal: 'manual',
    estado: 'accepted_administrative',
    latitud: null,
    registradoPor: enlace.id,
  });
  const audit = await audits();
  for (const action of [
    'attendance.captured',
    'attendance.reviewed',
    'attendance.corrected',
    'attendance.annulled',
    'attendance.captured-manual',
  ])
    expect(audit.some((a) => a.accion === action)).toBe(true);
  expect(
    JSON.stringify(audit.filter((a) => a.tipoEntidad === 'registros_asistencia')),
  ).not.toContain('-99.9');
});

it('rejects forged identities and cross-observer access and honors actual logout and account deactivation on replay', async () => {
  const f = await fixture(),
    other = await fixture(),
    key = v7();
  at('09:00:00');
  expect((await capture(f, 'check-in', { csrf: false })).status).toBe(403);
  expect(
    (
      await capture(f, 'check-in', {
        body: {
          assignmentId: f.assignmentId,
          expectedDate: date,
          location: gps,
          observerId: other.observerId,
        },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await capture(f, 'check-in', {
        body: { assignmentId: other.assignmentId, expectedDate: date, location: gps },
      })
    ).status,
  ).toBe(403);
  expect((await request('attendance', { cookie: f.cookie })).status).toBe(403);
  const result = await (await capture(f, 'check-in', { key })).json();
  expect(result.state).toBe('accepted_automatic');
  expect((await (await request('attendance/me', { cookie: other.cookie })).json()).total).toBe(0);
  expect(
    (await request(`attendance/${result.attendanceId}`, { cookie: other.cookie })).status,
  ).toBe(403);
  await json('auth/logout', {}, 204, { cookie: f.cookie });
  expect((await capture(f, 'check-in', { key })).status).toBe(401);
  f.cookie = await login(f.username);
  expect(await (await capture(f, 'check-in', { key })).json()).toEqual(result);
  expect(
    (await request(`users/${f.id}/status`, { method: 'PATCH', body: { active: false, reason } }))
      .status,
  ).toBe(204);
  expect((await capture(f, 'check-in', { key })).status).toBe(401);
  expect((await mark(result.attendanceId)).estado).toBe('accepted_automatic');
});

it('recovers a durable receipt after audit rollback and an application restart, while serializing concurrent retries', async () => {
  const f = await fixture(),
    key = v7();
  at('09:07:00');
  const beforeMarks = await db
      .select()
      .from(t.registrosAsistencia)
      .orderBy(t.registrosAsistencia.id),
    beforeAudit = await audits();
  rootSql(
    `CREATE TRIGGER \`${database}\`.synthetic_workflow_audit_failure BEFORE INSERT ON \`${database}\`.auditoria FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic-private-failure';`,
  );
  try {
    const failed = await capture(f, 'check-in', { key });
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain('synthetic-private-failure');
    expect(await db.select().from(t.registrosAsistencia).orderBy(t.registrosAsistencia.id)).toEqual(
      beforeMarks,
    );
    expect(await audits()).toEqual(beforeAudit);
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_workflow_audit_failure;`);
  }
  const receipts = await db
    .select()
    .from(t.recibosAsistencia)
    .where(eq(t.recibosAsistencia.usuarioId, f.id));
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    estado: 'pending',
    recibidoEn: instant('09:07:00').replace('T', ' ').slice(0, -1),
  });
  await app.close();
  await startApp();
  at('09:30:00');
  const responses = await Promise.all([
    capture(f, 'check-in', { key }),
    capture(f, 'check-in', { key }),
  ]);
  expect(responses.map((r) => r.status)).toEqual([201, 201]);
  const results = await Promise.all(responses.map((r) => r.json()));
  expect(results[0]).toEqual(results[1]);
  expect(results[0].state).toBe('accepted_automatic');
  expect((await mark(results[0].attendanceId)).registradoEn).toBe(receipts[0].recibidoEn);
  const captured = (await audits()).filter(
    (a) => a.accion === 'attendance.captured' && a.entidadId === results[0].attendanceId,
  );
  expect(captured).toHaveLength(1);
  expect(
    (await capture(f, 'check-in', { key, location: { missingReason: 'timeout' } })).status,
  ).toBe(409);
  expect((await capture(f)).status).toBe(409);
});
