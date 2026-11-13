import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { v7 } from 'uuid';
import { afterAll, beforeAll, expect, it, vi } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import {
  localDate,
  receivedAt,
  scheduledInstant,
} from '../dist/modules/attendance/attendance-time.js';
import { installRequestTimestamp } from '../dist/request-timestamp.js';
import * as t from '../dist/database/schema/index.js';
import { rootSql } from './helpers/mysql.mjs';

const suffix = randomBytes(8).toString('hex'),
  database = `hhpaisanos_test_${suffix}`,
  runtimeUser = `hhp_test_${suffix}`,
  runtimePassword = randomBytes(24).toString('hex');
const origin = 'http://localhost:5173',
  today = localDate(receivedAt(Date.now()));
const envKeys = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_ROOT_PASSWORD',
  'AUTH_ORIGINS',
];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const adminCodes = [
  'attendance:read',
  'attendance:capture-manual',
  'attendance:review',
  'attendance:correct',
  'attendance:annul',
];
const ownCodes = ['attendance:read-own', 'attendance:capture-own'];
const roles = {},
  permissions = {};
let app,
  db,
  url,
  admin,
  enlace,
  created = false,
  userCreated = false;
function day(offset) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
const iso = (value) => value.replace(' ', 'T') + 'Z';
const instant = (date, time) => iso(scheduledInstant(date, time));
async function account(role) {
  const id = v7(),
    sessionId = v7(),
    token = randomBytes(32).toString('base64url');
  await db.insert(t.usuarios).values({
    id,
    rolId: roles[role],
    nombreUsuario: `synthetic-${id}`,
    nombreCompleto: 'Synthetic admin attendance',
    passwordHash: 'synthetic-non-login-fixture',
    activo: true,
    debeCambiarPassword: false,
    intentosFallidos: 0,
  });
  await db.insert(t.sesiones).values({
    id: sessionId,
    usuarioId: id,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    ultimaActividadEn: receivedAt(Date.now()),
    expiraEnAbsoluto: `${day(30)} 23:59:59.000000`,
  });
  return { id, sessionId, cookie: `hhp_session=${token}` };
}
async function fixture() {
  const user = await account('OBSERVADOR');
  const [{ id: operativeId }] = await db
    .insert(t.operativos)
    .values({
      nombre: `Synthetic ${v7()}`,
      fechaInicio: day(-30),
      fechaFin: day(30),
      estado: 'activo',
      toleranciaMinutos: 15,
    })
    .$returningId();
  const [{ id: observerId }] = await db
    .insert(t.observadores)
    .values({ nombres: 'Synthetic', apellidos: 'Observer', usuarioId: user.id, activo: true })
    .$returningId();
  const [{ id: moduleId }] = await db
    .insert(t.modulosAtencion)
    .values({ nombre: 'Synthetic', municipio: 'Synthetic', activo: true })
    .$returningId();
  const [{ id: assignmentId }] = await db
    .insert(t.asignaciones)
    .values({
      operativoId: operativeId,
      observadorId: observerId,
      moduloId: moduleId,
      vigenteDesde: day(-20),
      vigenteHasta: day(20),
      horaInicio: '09:00:00',
      horaFin: '17:00:00',
      creadoPor: admin.id,
    })
    .$returningId();
  await db.insert(t.auditoria).values({
    usuarioId: admin.id,
    sesionId: admin.sessionId,
    tipoEntidad: 'observadores',
    entidadId: observerId,
    accion: 'observers.account.linked',
    valoresNuevos: { userId: user.id, verificationMethod: 'supervised_administrative' },
  });
  return { ...user, operativeId, observerId, moduleId, assignmentId };
}
function request(path = '', { actor = admin, method = 'GET', body, csrf = true } = {}) {
  return fetch(`${url}/api/attendance${path}`, {
    method,
    headers: {
      ...(actor ? { Cookie: actor.cookie } : {}),
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
const manualBody = (
  f,
  type = 'entrada',
  date = day(-1),
  time = type === 'entrada' ? '09:00:00' : '17:00:00',
) => ({
  observerId: f.observerId,
  assignmentId: f.assignmentId,
  date,
  type,
  officialTimestamp: instant(date, time),
  missingLocationReason: 'unsupported',
  reason: 'Synthetic historical capture',
});
const manual = (f, body = manualBody(f), actor = admin) =>
  request('/manual', { actor, method: 'POST', body });
const action = (id, kind, body, actor = admin) =>
  request(`/${id}/${kind}`, { actor, method: 'POST', body });
const decision = (extra = {}) => ({
  expectedVersion: 1,
  reason: 'Synthetic administrative decision',
  ...extra,
});
const markRow = async (id) =>
  (await db.select().from(t.registrosAsistencia).where(eq(t.registrosAsistencia.id, id)))[0];
const attendanceEvents = () =>
  db.select().from(t.auditoria).where(eq(t.auditoria.tipoEntidad, 'registros_asistencia'));
async function personal(
  f,
  time = '09:20:00',
  location = { latitude: 16.85, longitude: -99.9, accuracy: 3 },
) {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(instant(today, time)));
  try {
    const response = await fetch(`${url}/api/attendance/me/check-in`, {
      method: 'POST',
      headers: {
        Cookie: f.cookie,
        'Content-Type': 'application/json',
        Origin: origin,
        'X-HHP-CSRF': '1',
        'Idempotency-Key': v7(),
      },
      body: JSON.stringify({ assignmentId: f.assignmentId, expectedDate: today, location }),
    });
    expect(response.status).toBe(201);
    return (await response.json()).attendanceId;
  } finally {
    clock.mockRestore();
  }
}

beforeAll(async () => {
  process.env.DB_PASSWORD ??= 'synthetic-compose-placeholder';
  process.env.DB_ROOT_PASSWORD ??= 'synthetic-compose-placeholder';
  if (!rootSql('SELECT VERSION();').startsWith('8.4.')) throw new Error('MySQL 8.4 required');
  rootSql(`CREATE DATABASE \`${database}\`;`);
  created = true;
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
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  installRequestTimestamp(app);
  await app.listen(0, 'localhost');
  url = await app.getUrl();
  db = app.get(DatabaseService).db;
  for (const code of ['ADMIN', 'ENLACE', 'OBSERVADOR']) {
    roles[code] = v7();
    await db.insert(t.roles).values({ id: roles[code], codigo: code, nombre: code, activo: true });
  }
  for (const code of [...adminCodes, ...ownCodes]) {
    permissions[code] = v7();
    await db.insert(t.permisos).values({ id: permissions[code], codigo: code });
    for (const role of ownCodes.includes(code) ? ['OBSERVADOR'] : ['ADMIN', 'ENLACE'])
      await db.insert(t.rolPermisos).values({ rolId: roles[role], permisoId: permissions[code] });
  }
  admin = await account('ADMIN');
  enlace = await account('ENLACE');
}, 60000);
afterAll(async () => {
  try {
    await app?.close();
  } finally {
    try {
      if (created) rootSql(`DROP DATABASE \`${database}\`;`);
      if (userCreated) rootSql(`DROP USER '${runtimeUser}'@'%';`);
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }
}, 30000);

it('ADMIN and ENLACE manage the same Guerrero scope through explicit administrative permissions', async () => {
  const a = await fixture(),
    b = await fixture();
  const first = await manual(a, manualBody(a), admin),
    second = await manual(b, manualBody(b), enlace);
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  const id = (await first.json()).id;
  for (const actor of [admin, enlace]) {
    const response = await request('', { actor });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const list = await response.json();
    expect(list.items.some((row) => row.observerId === a.observerId)).toBe(true);
    expect(list.items.some((row) => row.observerId === b.observerId)).toBe(true);
    expect((await request(`/${id}`, { actor })).status).toBe(200);
    expect((await request(`/${id}/history`, { actor })).status).toBe(200);
  }
  expect((await request('/me', { actor: a })).status).toBe(200);
  for (const actor of [admin, enlace]) expect((await request('/me', { actor })).status).toBe(403);
});

it('lists current marks with bounded validated filters and separates completeness, review status and factual anomalies', async () => {
  const f = await fixture(),
    id = await personal(f, '09:20:00', { missingReason: 'timeout' });
  const base = `?observerId=${f.observerId}&operativeId=${f.operativeId}&moduleId=${f.moduleId}&from=${today}&to=${today}`;
  const response = await request(
    base + '&reviewStatus=pending_review&anomaly=late_arrival&limit=1',
  );
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data).toMatchObject({
    total: 1,
    page: 1,
    limit: 1,
    items: [
      {
        id,
        completeness: 'check_in_only',
        reviewStatus: 'pending_review',
        anomalies: ['late_arrival', 'missing_location'],
        locationEvidence: { status: 'missing', reason: 'timeout' },
      },
    ],
  });
  expect((await (await request(base + '&anomaly=missing_location')).json()).total).toBe(1);
  expect((await (await request(base + '&anomaly=early_departure')).json()).total).toBe(0);
  expect((await (await request(base + '&page=2&limit=1')).json()).items).toEqual([]);
  for (const path of [
    '?limit=101',
    '?page=0',
    '?page=1000001',
    '?observerId=invalid',
    '?reviewStatus=invalid',
    '?anomaly=invalid',
    `?from=${today}&to=${day(-1)}`,
    '?officeId=unapproved',
  ])
    expect((await request(path)).status).toBe(400);
  const empty = await request(`?observerId=${v7()}`);
  expect((await empty.json()).total).toBe(0);
});

it('accepts/rejects pending incidents with reasons and preserves exact factual evidence and timestamps', async () => {
  const f = await fixture(),
    id = await personal(f),
    before = await markRow(id);
  const accepted = await action(id, 'review', decision({ decision: 'accept' }), enlace);
  expect(accepted.status).toBe(200);
  expect(await accepted.json()).toMatchObject({
    reviewStatus: 'accepted_administrative',
    version: 1,
  });
  const after = await markRow(id);
  expect(after).toMatchObject({
    ...before,
    estado: 'accepted_administrative',
    revisadoPor: enlace.id,
    revisadoEn: expect.any(String),
    motivoDecision: 'Synthetic administrative decision',
  });
  const detail = await (await request(`/${id}`)).json();
  expect(detail).toMatchObject({
    anomalies: ['late_arrival'],
    originalEventTimestamp: iso(before.registradoEn),
    locationEvidence: {
      status: 'provided_unverified',
      latitude: 16.85,
      longitude: -99.9,
      accuracy: 3,
    },
  });
  const list = await (await request(`?observerId=${f.observerId}`)).json();
  expect(JSON.stringify(list)).not.toContain('latitude');
  expect(JSON.stringify(list)).not.toContain('-99.9');
  const rejectedFixture = await fixture(),
    rejectedId = await personal(rejectedFixture);
  expect((await action(rejectedId, 'review', decision({ decision: 'reject' }))).status).toBe(200);
  expect((await markRow(rejectedId)).estado).toBe('rejected');
  expect((await action(id, 'review', decision({ decision: 'reject' }))).status).toBe(409);
  const audit = (await attendanceEvents()).filter(
    (row) => row.entidadId === id && row.accion === 'attendance.reviewed',
  );
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({
    usuarioId: enlace.id,
    sesionId: enlace.sessionId,
    motivo: 'Synthetic administrative decision',
    valoresAnteriores: { state: 'pending_review' },
    valoresNuevos: { state: 'accepted_administrative' },
  });
  expect(JSON.stringify(audit)).not.toContain('-99.9');
});

it('serializes concurrent review decisions across ADMIN and ENLACE and rejects stale/current-version conflicts', async () => {
  const f = await fixture(),
    id = await personal(f),
    before = (await attendanceEvents()).length;
  const responses = await Promise.all([
    action(id, 'review', decision({ decision: 'accept' })),
    action(id, 'review', decision({ decision: 'reject' }), enlace),
  ]);
  expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409]);
  expect(await attendanceEvents()).toHaveLength(before + 1);
  expect((await action(id, 'annul', decision({ expectedVersion: 2 }))).status).toBe(409);
});

it('manually captures valid historical periods in closed operatives without reactivation, fabricated GPS or fabricated counterpart marks', async () => {
  const f = await fixture();
  await db
    .update(t.operativos)
    .set({ estado: 'cerrado', fechaFin: day(-1) })
    .where(eq(t.operativos.id, f.operativeId));
  await db
    .update(t.asignaciones)
    .set({ vigenteHasta: day(-1) })
    .where(eq(t.asignaciones.id, f.assignmentId));
  await db.update(t.observadores).set({ activo: false }).where(eq(t.observadores.id, f.observerId));
  await db
    .update(t.modulosAtencion)
    .set({ activo: false })
    .where(eq(t.modulosAtencion.id, f.moduleId));
  const out = await manual(f, manualBody(f, 'salida', day(-1), '16:00:00'), enlace);
  expect(out.status).toBe(201);
  const exitId = (await out.json()).id;
  expect(await (await request(`/${exitId}`)).json()).toMatchObject({
    completeness: 'check_out_only',
    reviewStatus: 'accepted_administrative',
    anomalies: ['early_departure', 'missing_location'],
    locationEvidence: { status: 'missing', reason: 'unsupported' },
  });
  const entry = await manual(f);
  expect(entry.status).toBe(201);
  const id = (await entry.json()).id;
  const stored = await markRow(id);
  expect(stored).toMatchObject({
    canal: 'manual',
    registradoPor: admin.id,
    reciboId: null,
    latitud: null,
    longitud: null,
    precisionM: null,
    motivoCapturaManual: 'Synthetic historical capture',
    estado: 'accepted_administrative',
    revisadoPor: admin.id,
  });
  expect((await (await request(`/${id}`)).json()).completeness).toBe('complete');
  expect(
    (await db.select().from(t.operativos).where(eq(t.operativos.id, f.operativeId)))[0].estado,
  ).toBe('cerrado');
  expect((await manual(f)).status).toBe(409);
});

it('validates historical observer, assignment, date, operative, declared absence and six-digit event instants', async () => {
  const f = await fixture(),
    body = manualBody(f);
  for (const invalid of [
    { ...body, reason: '  ' },
    { ...body, missingLocationReason: 'other' },
    { ...body, missingLocationReason: undefined },
    { ...body, location: { latitude: 0, longitude: 0, accuracy: 0 } },
    { ...body, officialTimestamp: body.officialTimestamp.replace('.000000', '.000') },
    { ...body, officialTimestamp: '2030-02-30T15:00:00.000000Z' },
    { ...body, estado: 'accepted_administrative' },
    { ...body, userId: admin.id },
  ])
    expect((await manual(f, invalid)).status).toBe(400);
  for (const invalid of [
    { ...body, observerId: v7() },
    { ...body, date: day(1), officialTimestamp: instant(day(1), '09:00:00') },
    { ...body, officialTimestamp: instant(day(-2), '09:00:00') },
    { ...body, date: day(-21), officialTimestamp: instant(day(-21), '09:00:00') },
  ])
    expect((await manual(f, invalid)).status).toBe(409);
  expect((await manual(f, { ...body, assignmentId: v7() })).status).toBe(404);
  await db
    .update(t.operativos)
    .set({ estado: 'borrador' })
    .where(eq(t.operativos.id, f.operativeId));
  expect((await manual(f)).status).toBe(409);
  await db.update(t.operativos).set({ estado: 'activo' }).where(eq(t.operativos.id, f.operativeId));
  const precise = {
    ...body,
    officialTimestamp: instant(day(-1), '09:15:00').replace('.000000', '.000001'),
  };
  const response = await manual(f, precise);
  expect(response.status).toBe(201);
  const row = await markRow((await response.json()).id);
  expect(row.registradoEn.endsWith('.000001')).toBe(true);
  expect(row.llegadaTardia).toBe(1);
  const cancelled = await fixture();
  await db
    .update(t.asignaciones)
    .set({ canceladaEn: sql`UTC_TIMESTAMP(6)` })
    .where(eq(t.asignaciones.id, cancelled.assignmentId));
  expect((await manual(cancelled)).status).toBe(409);
});

it('creates pending correction versions without inherited acceptance; preserves original GPS, receipt and capture provenance', async () => {
  const f = await fixture(),
    id = await personal(f);
  expect((await action(id, 'review', decision({ decision: 'accept' }))).status).toBe(200);
  const original = await markRow(id);
  const result = await action(
    id,
    'corrections',
    decision({ officialTimestamp: instant(today, '09:10:00') }),
    enlace,
  );
  expect(result.status).toBe(201);
  const correction = await result.json();
  expect(correction).toMatchObject({ version: 2, reviewStatus: 'pending_review' });
  expect(await markRow(id)).toEqual({ ...original, vigente: null });
  const newer = await markRow(correction.id);
  expect(newer).toMatchObject({
    version: 2,
    anteriorId: id,
    reciboId: null,
    registradoPor: f.id,
    canal: 'web',
    latitud: original.latitud,
    longitud: original.longitud,
    precisionM: original.precisionM,
    motivoSinUbicacion: null,
    estado: 'pending_review',
    llegadaTardia: 0,
    revisadoPor: null,
    revisadoEn: null,
    motivoDecision: null,
  });
  const detail = await (await request(`/${correction.id}`)).json();
  expect(detail).toMatchObject({
    anomalies: [],
    originalEventTimestamp: iso(original.registradoEn),
    officialTimestamp: instant(today, '09:10:00'),
  });
  expect((await action(id, 'review', decision({ decision: 'reject' }))).status).toBe(409);
  expect(
    (await action(id, 'corrections', decision({ officialTimestamp: instant(today, '09:00:00') })))
      .status,
  ).toBe(409);
  const history = await (await request(`/${id}/history?limit=1&page=1`)).json();
  expect(history).toMatchObject({
    total: 2,
    items: [{ id, current: false, version: 1, reviewStatus: 'accepted_administrative' }],
  });
  expect(
    history.items[0].events.some(
      (event) =>
        event.action === 'attendance.reviewed' && event.reviewStatus === 'accepted_administrative',
    ),
  ).toBe(true);
  const history2 = await (await request(`/${correction.id}/history?page=2&limit=1`)).json();
  expect(history2.items[0]).toMatchObject({
    id: correction.id,
    reviewStatus: 'pending_review',
    version: 2,
  });
  expect(JSON.stringify(history2)).not.toContain('latitude');
  expect(JSON.stringify(history2)).not.toContain('receipt');
  expect(
    (await action(correction.id, 'review', decision({ expectedVersion: 2, decision: 'accept' })))
      .status,
  ).toBe(200);
  expect((await markRow(correction.id)).estado).toBe('accepted_administrative');
});

it('correction-only permission cannot review, and concurrent corrections produce only one next version', async () => {
  const f = await fixture(),
    id = await personal(f),
    where = and(
      eq(t.rolPermisos.rolId, roles.ENLACE),
      eq(t.rolPermisos.permisoId, permissions['attendance:review']),
    );
  await db.delete(t.rolPermisos).where(where);
  try {
    const responses = await Promise.all([
      action(
        id,
        'corrections',
        decision({ officialTimestamp: instant(today, '09:00:00') }),
        enlace,
      ),
      action(id, 'corrections', decision({ officialTimestamp: instant(today, '09:05:00') })),
    ]);
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    const success = await responses.find((r) => r.status === 201).json();
    expect((await markRow(success.id)).estado).toBe('pending_review');
    expect(
      (
        await action(
          success.id,
          'review',
          decision({ expectedVersion: 2, decision: 'accept' }),
          enlace,
        )
      ).status,
    ).toBe(403);
  } finally {
    await db
      .insert(t.rolPermisos)
      .values({ rolId: roles.ENLACE, permisoId: permissions['attendance:review'] });
  }
});

it('annuls without deleting evidence or history and never recreates annulled logical marks', async () => {
  const f = await fixture(),
    id = await personal(f),
    original = await markRow(id);
  expect((await action(id, 'annul', decision())).status).toBe(200);
  expect(await markRow(id)).toMatchObject({
    ...original,
    estado: 'annulled',
    revisadoPor: admin.id,
    revisadoEn: expect.any(String),
    motivoDecision: 'Synthetic administrative decision',
  });
  expect((await action(id, 'annul', decision())).status).toBe(409);
  expect(
    (await action(id, 'corrections', decision({ officialTimestamp: instant(today, '09:00:00') })))
      .status,
  ).toBe(409);
  expect((await manual(f, manualBody(f, 'entrada', today))).status).toBe(409);
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(instant(today, '10:00:00')));
  try {
    const response = await fetch(`${url}/api/attendance/me/check-in`, {
      method: 'POST',
      headers: {
        Cookie: f.cookie,
        'Content-Type': 'application/json',
        Origin: origin,
        'X-HHP-CSRF': '1',
        'Idempotency-Key': v7(),
      },
      body: JSON.stringify({
        assignmentId: f.assignmentId,
        expectedDate: today,
        location: { missingReason: 'timeout' },
      }),
    });
    expect(response.status).toBe(409);
  } finally {
    clock.mockRestore();
  }
  expect((await (await request(`/${id}/history`)).json()).items[0].reviewStatus).toBe('annulled');
});

it('preserves manual provenance on corrections and enforces relative mark ordering', async () => {
  const f = await fixture(),
    entry = await (await manual(f)).json();
  expect((await manual(f, manualBody(f, 'salida', day(-1), '08:00:00'))).status).toBe(409);
  const exit = await (await manual(f, manualBody(f, 'salida'))).json();
  expect(
    (
      await action(
        entry.id,
        'corrections',
        decision({ officialTimestamp: instant(day(-1), '18:00:00') }),
      )
    ).status,
  ).toBe(409);
  const corrected = await action(
    entry.id,
    'corrections',
    decision({ officialTimestamp: instant(day(-1), '09:05:00') }),
  );
  expect(corrected.status).toBe(201);
  const row = await markRow((await corrected.json()).id);
  expect(row).toMatchObject({
    canal: 'manual',
    registradoPor: admin.id,
    motivoCapturaManual: 'Synthetic historical capture',
    estado: 'pending_review',
    revisadoPor: null,
  });
  expect((await markRow(exit.id)).estado).toBe('accepted_administrative');
});

it('rolls back all four administrative writes when transactional audit insertion fails', async () => {
  const f = await fixture(),
    reviewId = await personal(f),
    g = await fixture(),
    correctId = await personal(g),
    h = await fixture(),
    annulId = await personal(h),
    manualFixture = await fixture();
  const originalMarks = await db.select().from(t.registrosAsistencia),
    originalAudits = await attendanceEvents();
  rootSql(
    `CREATE TRIGGER \`${database}\`.synthetic_admin_audit_failure BEFORE INSERT ON \`${database}\`.auditoria FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic-private-evidence';`,
  );
  try {
    for (const work of [
      () => manual(manualFixture),
      () => action(reviewId, 'review', decision({ decision: 'accept' })),
      () =>
        action(
          correctId,
          'corrections',
          decision({ officialTimestamp: instant(today, '09:00:00') }),
        ),
      () => action(annulId, 'annul', decision()),
    ]) {
      const response = await work();
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('synthetic-private-evidence');
      expect(await db.select().from(t.registrosAsistencia)).toEqual(originalMarks);
      expect(await attendanceEvents()).toEqual(originalAudits);
    }
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_admin_audit_failure;`);
  }
});

it('denies OBSERVADOR even with accidental administrative grants, enforces every explicit permission, active accounts and input validation', async () => {
  const f = await fixture(),
    id = await personal(f),
    calls = [
      ['', 'GET', undefined, 'attendance:read'],
      [`/${id}`, 'GET', undefined, 'attendance:read'],
      [`/${id}/history`, 'GET', undefined, 'attendance:read'],
      ['/manual', 'POST', manualBody(await fixture()), 'attendance:capture-manual'],
      [`/${id}/review`, 'POST', decision({ decision: 'accept' }), 'attendance:review'],
      [
        `/${id}/corrections`,
        'POST',
        decision({ officialTimestamp: instant(today, '09:00:00') }),
        'attendance:correct',
      ],
      [`/${id}/annul`, 'POST', decision(), 'attendance:annul'],
    ];
  for (const code of adminCodes)
    await db
      .insert(t.rolPermisos)
      .values({ rolId: roles.OBSERVADOR, permisoId: permissions[code] });
  try {
    for (const [path, method, body] of calls)
      expect((await request(path, { actor: f, method, body })).status).toBe(403);
  } finally {
    for (const code of adminCodes)
      await db
        .delete(t.rolPermisos)
        .where(
          and(
            eq(t.rolPermisos.rolId, roles.OBSERVADOR),
            eq(t.rolPermisos.permisoId, permissions[code]),
          ),
        );
  }
  for (const [path, method, body, permission] of calls) {
    expect((await request(path, { actor: null, method, body })).status).toBe(401);
    const where = and(
      eq(t.rolPermisos.rolId, roles.ADMIN),
      eq(t.rolPermisos.permisoId, permissions[permission]),
    );
    await db.delete(t.rolPermisos).where(where);
    try {
      expect((await request(path, { method, body })).status).toBe(403);
    } finally {
      await db
        .insert(t.rolPermisos)
        .values({ rolId: roles.ADMIN, permisoId: permissions[permission] });
    }
  }
  for (const body of [
    decision({ decision: 'accept', reason: ' ' }),
    { reason: 'No version', decision: 'accept' },
    decision({ expectedVersion: '1', decision: 'accept' }),
    decision({ expectedVersion: 0, decision: 'accept' }),
    decision({ decision: 'accept', officialTimestamp: instant(today, '09:00:00') }),
  ])
    expect((await action(id, 'review', body)).status).toBe(400);
  expect(
    (
      await request(`/${id}/review`, {
        method: 'POST',
        csrf: false,
        body: decision({ decision: 'accept' }),
      })
    ).status,
  ).toBe(403);
  expect((await request('/not-a-uuid')).status).toBe(400);
  expect((await request(`/${v7()}`)).status).toBe(404);
  const inactive = await account('ENLACE');
  await db.update(t.usuarios).set({ activo: false }).where(eq(t.usuarios.id, inactive.id));
  expect((await request('', { actor: inactive })).status).toBe(401);
});

it('revalidates a revoked permission after waiting on the administrative actor lock', async () => {
  const f = await fixture(),
    id = await personal(f),
    locked = Promise.withResolvers(),
    release = Promise.withResolvers();
  const holder = db.transaction(async (tx) => {
    await tx.select().from(t.usuarios).where(eq(t.usuarios.id, enlace.id)).for('update');
    locked.resolve();
    await release.promise;
    await tx
      .delete(t.rolPermisos)
      .where(
        and(
          eq(t.rolPermisos.rolId, roles.ENLACE),
          eq(t.rolPermisos.permisoId, permissions['attendance:review']),
        ),
      );
  });
  let pending;
  try {
    await locked.promise;
    pending = action(id, 'review', decision({ decision: 'accept' }), enlace);
    await expect
      .poll(
        () =>
          rootSql(
            `SELECT COUNT(*) FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.BLOCKING_ENGINE_LOCK_ID WHERE l.OBJECT_SCHEMA='${database}' AND l.OBJECT_NAME='usuarios';`,
          ),
        { timeout: 10000 },
      )
      .not.toBe('0');
  } finally {
    release.resolve();
    await holder;
    try {
      if (pending) expect((await pending).status).toBe(403);
    } finally {
      await db
        .insert(t.rolPermisos)
        .values({ rolId: roles.ENLACE, permisoId: permissions['attendance:review'] });
    }
  }
  expect((await markRow(id)).estado).toBe('pending_review');
});
