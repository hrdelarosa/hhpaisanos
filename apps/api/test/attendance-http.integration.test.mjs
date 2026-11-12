import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { v7 } from 'uuid';
import { afterAll, beforeAll, expect, it, vi } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { AttendancePersistence } from '../dist/modules/attendance/attendance.persistence.js';
import {
  localDate,
  receivedAt,
  scheduledInstant,
} from '../dist/modules/attendance/attendance-time.js';
import { installRequestTimestamp } from '../dist/request-timestamp.js';
import * as t from '../dist/database/schema/index.js';
import { rootSql } from './helpers/mysql.mjs';

const suffix = randomBytes(8).toString('hex');
const database = `hhpaisanos_test_${suffix}`,
  runtimeUser = `hhp_test_${suffix}`;
const runtimePassword = randomBytes(24).toString('hex');
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
const today = localDate(receivedAt(Date.now()));
const roles = {},
  permissions = {};
let app,
  db,
  baseUrl,
  admin,
  persistence,
  created = false,
  userCreated = false;

function day(offset) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
const timestamp = (time, date = today) =>
  Date.parse(scheduledInstant(date, time).replace(' ', 'T') + 'Z');
async function at(time, work) {
  const clock = vi
    .spyOn(Date, 'now')
    .mockReturnValue(typeof time === 'number' ? time : timestamp(time));
  try {
    return await work(clock);
  } finally {
    clock.mockRestore();
  }
}

async function account(role = 'OBSERVADOR') {
  const id = v7(),
    sessionId = v7(),
    token = randomBytes(32).toString('base64url');
  await db.insert(t.usuarios).values({
    id,
    rolId: roles[role],
    nombreUsuario: `synthetic-${id}`,
    nombreCompleto: 'Synthetic attendance',
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
async function fixture(accredited = true, role = 'OBSERVADOR') {
  const user = await account(role);
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
      vigenteDesde: day(-5),
      vigenteHasta: day(20),
      horaInicio: '09:00:00',
      horaFin: '17:00:00',
      creadoPor: admin.id,
    })
    .$returningId();
  if (accredited)
    await db.insert(t.auditoria).values({
      usuarioId: admin.id,
      sesionId: admin.sessionId,
      tipoEntidad: 'observadores',
      entidadId: observerId,
      accion: 'observers.account.linked',
      valoresNuevos: { userId: user.id, verificationMethod: 'supervised_administrative' },
    });
  return {
    ...user,
    operativeId,
    observerId,
    moduleId,
    assignmentId,
    body: {
      assignmentId,
      expectedDate: today,
      location: { latitude: 16.85, longitude: -99.9, accuracy: 0 },
    },
  };
}
function capture(
  f,
  path = 'check-in',
  { body = f.body, key = v7(), cookie = f.cookie, csrf = true } = {},
) {
  return fetch(`${baseUrl}/api/attendance/me/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(csrf ? { 'X-HHP-CSRF': '1' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(key === null ? {} : { 'Idempotency-Key': key }),
    },
    body: JSON.stringify(body),
  });
}
function read(f, path = 'today') {
  return fetch(`${baseUrl}/api/attendance/me${path ? `/${path}` : ''}`, {
    headers: { Cookie: f.cookie },
  });
}
const marks = (f) =>
  db
    .select()
    .from(t.registrosAsistencia)
    .where(eq(t.registrosAsistencia.asignacionId, f.assignmentId));
const receipts = (f) =>
  db.select().from(t.recibosAsistencia).where(eq(t.recibosAsistencia.usuarioId, f.id));
const attendanceAudits = () =>
  db.select().from(t.auditoria).where(eq(t.auditoria.accion, 'attendance.captured'));

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
  baseUrl = await app.getUrl();
  db = app.get(DatabaseService).db;
  persistence = app.get(AttendancePersistence);
  for (const code of ['ADMIN', 'ENLACE', 'OBSERVADOR']) {
    roles[code] = v7();
    await db.insert(t.roles).values({ id: roles[code], codigo: code, nombre: code, activo: true });
  }
  for (const code of ['attendance:read-own', 'attendance:capture-own']) {
    permissions[code] = v7();
    await db.insert(t.permisos).values({ id: permissions[code], codigo: code });
    await db
      .insert(t.rolPermisos)
      .values({ rolId: roles.OBSERVADOR, permisoId: permissions[code] });
  }
  admin = await account('ADMIN');
}, 60000);
afterAll(async () => {
  try {
    await app?.close();
  } finally {
    try {
      if (created) rootSql(`DROP DATABASE \`${database}\`;`);
      if (userCreated) rootSql(`DROP USER '${runtimeUser}'@'%';`);
    } finally {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }
}, 30000);

it('serves the daily context without fabricated absences; captures exact-tolerance entry and end-time exit', async () => {
  const f = await fixture();
  await at('09:15:00', async () => {
    const initial = await (await read(f)).json();
    expect(initial).toMatchObject({
      date: today,
      timeZone: 'America/Mexico_City',
      assignments: [
        {
          assignmentId: f.assignmentId,
          startTime: '09:00:00',
          endTime: '17:00:00',
          arrivalToleranceMinutes: 15,
          completeness: 'none',
          checkIn: null,
          checkOut: null,
        },
      ],
    });
    const response = await capture(f);
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ state: 'accepted_automatic' });
  });
  await at('17:00:00', async () => {
    expect((await capture(f, 'check-out')).status).toBe(201);
    const response = await read(f);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const result = await response.json();
    expect(result.assignments[0]).toMatchObject({
      completeness: 'complete',
      checkIn: {
        reviewStatus: 'accepted_automatic',
        anomalies: [],
        locationEvidence: { status: 'provided_unverified' },
        officialTimestamp: scheduledInstant(today, '09:15:00').replace(' ', 'T') + 'Z',
      },
      checkOut: { reviewStatus: 'accepted_automatic', anomalies: [] },
    });
    const encoded = JSON.stringify(result);
    for (const secret of [
      'latitude',
      'longitude',
      'accuracy',
      f.id,
      'receiptId',
      'contenido',
      '-99.9',
    ])
      expect(encoded).not.toContain(secret);
  });
  expect(await marks(f)).toHaveLength(2);
  expect((await marks(f)).every((mark) => mark.politicaVersion === 'personal-v1')).toBe(true);
});

it('classifies the first late millisecond, early exit and controlled missing evidence without blocking capture', async () => {
  const f = await fixture();
  const body = { ...f.body, location: { missingReason: 'permission_denied' } };
  await at(timestamp('09:15:00') + 1, async () =>
    expect((await capture(f, 'check-in', { body })).status).toBe(201),
  );
  await at('16:59:59', async () => {
    expect(
      (await capture(f, 'check-out', { body: { ...body, location: { missingReason: 'timeout' } } }))
        .status,
    ).toBe(201);
    const result = await (await read(f)).json();
    expect(result.assignments[0]).toMatchObject({
      completeness: 'complete',
      checkIn: {
        reviewStatus: 'pending_review',
        anomalies: ['late_arrival', 'missing_location'],
        locationEvidence: { status: 'missing', reason: 'permission_denied' },
      },
      checkOut: {
        reviewStatus: 'pending_review',
        anomalies: ['early_departure', 'missing_location'],
      },
    });
  });
  expect((await marks(f)).find((m) => m.tipo === 'entrada').registradoEn.endsWith('.001000')).toBe(
    true,
  );
});

it('accepts each approved missing-location reason alone, but rejects malformed or mixed location content and client identity/state', async () => {
  await at('09:00:00', async () => {
    for (const reason of [
      'permission_denied',
      'position_unavailable',
      'timeout',
      'unsupported',
      'insecure_context',
      'unexpected_error',
    ]) {
      const f = await fixture();
      expect(
        (await capture(f, 'check-in', { body: { ...f.body, location: { missingReason: reason } } }))
          .status,
      ).toBe(201);
      expect((await (await read(f)).json()).assignments[0].checkIn.anomalies).toEqual([
        'missing_location',
      ]);
    }
    const f = await fixture();
    for (const location of [
      null,
      {},
      { latitude: 91, longitude: 0, accuracy: 1 },
      { latitude: 0, longitude: 181, accuracy: 1 },
      { latitude: 0, longitude: 0, accuracy: -1 },
      { latitude: '0', longitude: 0, accuracy: 1 },
      { latitude: 0, longitude: 0 },
      { missingReason: 'other' },
      { ...f.body.location, missingReason: 'timeout' },
    ])
      expect((await capture(f, 'check-in', { body: { ...f.body, location } })).status).toBe(400);
    for (const body of [
      { ...f.body, observerId: f.observerId },
      { ...f.body, userId: f.id },
      { ...f.body, state: 'accepted_automatic' },
      { ...f.body, type: 'salida' },
      { ...f.body, expectedDate: '2030-02-30' },
    ])
      expect((await capture(f, 'check-in', { body })).status).toBe(400);
    for (const key of [null, 'x'.repeat(129), 'invalid key'])
      expect((await capture(f, 'check-in', { key })).status).toBe(400);
    expect(await receipts(f)).toEqual([]);
    expect(await marks(f)).toEqual([]);
  });
});

it('enforces logical ordering and requires an exit to occur strictly after a usable entry', async () => {
  const f = await fixture();
  await at('09:00:00', async () => {
    const noEntry = await capture(f, 'check-out');
    expect(noEntry.status).toBe(409);
    expect(await noEntry.json()).toMatchObject({ code: 'invalid_order' });
    expect((await capture(f)).status).toBe(201);
    expect((await capture(f, 'check-out')).status).toBe(409);
  });
  await at('08:59:59', async () => expect((await capture(f, 'check-out')).status).toBe(409));
  await at('17:00:00', async () => {
    expect((await capture(f, 'check-out')).status).toBe(201);
    expect((await capture(f)).status).toBe(409);
    expect((await capture(f, 'check-out')).status).toBe(409);
  });
  const other = await fixture();
  await at('09:00:00', async () => expect((await capture(other)).status).toBe(201));
  const [entry] = await marks(other);
  await db
    .update(t.registrosAsistencia)
    .set({
      estado: 'rejected',
      revisadoPor: admin.id,
      revisadoEn: receivedAt(Date.now()),
      motivoDecision: 'Synthetic rejection',
    })
    .where(eq(t.registrosAsistencia.id, entry.id));
  await at('17:00:00', async () => expect((await capture(other, 'check-out')).status).toBe(409));
});

it('replays lost responses with the original timestamp, serializes identical keys and rejects conflicting keys or duplicate marks', async () => {
  await at('09:00:00', async () => {
    const f = await fixture(),
      key = v7(),
      before = (await attendanceAudits()).length;
    const responses = await Promise.all([
      capture(f, 'check-in', { key }),
      capture(f, 'check-in', { key }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    const first = await responses[0].json();
    expect(await responses[1].json()).toEqual(first);
    expect(await marks(f)).toHaveLength(1);
    expect(await receipts(f)).toHaveLength(1);
    expect(await attendanceAudits()).toHaveLength(before + 1);
    expect(
      (
        await capture(f, 'check-in', {
          key,
          body: { ...f.body, location: { ...f.body.location, accuracy: 1 } },
        })
      ).status,
    ).toBe(409);
    expect((await capture(f, 'check-out', { key })).status).toBe(409);
    await at('10:00:00', async () =>
      expect(await (await capture(f, 'check-in', { key })).json()).toEqual(first),
    );
    expect((await marks(f))[0].registradoEn).toBe(scheduledInstant(today, '09:00:00'));
    const distinct = await fixture();
    const duplicates = await Promise.all([capture(distinct), capture(distinct)]);
    expect(duplicates.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await marks(distinct)).toHaveLength(1);
    const conflict = await fixture(),
      sharedKey = v7();
    const conflicts = await Promise.all([
      capture(conflict, 'check-in', { key: sharedKey }),
      capture(conflict, 'check-in', {
        key: sharedKey,
        body: { ...conflict.body, location: { missingReason: 'timeout' } },
      }),
    ]);
    expect(conflicts.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await receipts(conflict)).toHaveLength(1);
  });
});

it('requires explicit observer permissions, active identity/account-link evidence and CSRF', async () => {
  const f = await fixture();
  expect((await capture(f, 'check-in', { cookie: null })).status).toBe(401);
  expect((await capture(f, 'check-in', { csrf: false })).status).toBe(403);
  for (const code of ['ADMIN', 'ENLACE']) {
    const privileged = await fixture(true, code);
    for (const permission of Object.values(permissions))
      await db.insert(t.rolPermisos).values({ rolId: roles[code], permisoId: permission });
    try {
      expect((await capture(privileged)).status).toBe(403);
      expect((await read(privileged)).status).toBe(403);
    } finally {
      await db.delete(t.rolPermisos).where(eq(t.rolPermisos.rolId, roles[code]));
    }
  }
  for (const permission of ['attendance:read-own', 'attendance:capture-own']) {
    const where = and(
      eq(t.rolPermisos.rolId, roles.OBSERVADOR),
      eq(t.rolPermisos.permisoId, permissions[permission]),
    );
    await db.delete(t.rolPermisos).where(where);
    try {
      expect((await (permission.endsWith('read-own') ? read(f) : capture(f))).status).toBe(403);
    } finally {
      await db
        .insert(t.rolPermisos)
        .values({ rolId: roles.OBSERVADOR, permisoId: permissions[permission] });
    }
  }
  const unlinked = await fixture(false);
  expect((await capture(unlinked)).status).toBe(403);
  expect((await read(unlinked)).status).toBe(403);
  const inactive = await fixture();
  await db
    .update(t.observadores)
    .set({ activo: false })
    .where(eq(t.observadores.id, inactive.observerId));
  expect((await capture(inactive)).status).toBe(403);
  expect((await read(inactive)).status).toBe(403);
  const noProfile = await account();
  expect((await read(noProfile)).status).toBe(403);
  await db.update(t.usuarios).set({ activo: false }).where(eq(t.usuarios.id, f.id));
  expect((await capture(f)).status).toBe(401);
  expect((await read(f)).status).toBe(401);
});

it('rejects inapplicable assignments, inactive/expired operatives and inactive modules, without accepting client observer identity', async () => {
  await at('09:00:00', async () => {
    for (const change of [
      (f) =>
        db
          .update(t.operativos)
          .set({ estado: 'borrador' })
          .where(eq(t.operativos.id, f.operativeId)),
      (f) =>
        db
          .update(t.operativos)
          .set({ fechaFin: day(-1) })
          .where(eq(t.operativos.id, f.operativeId)),
      (f) =>
        db
          .update(t.operativos)
          .set({ toleranciaMinutos: null })
          .where(eq(t.operativos.id, f.operativeId)),
      (f) =>
        db
          .update(t.modulosAtencion)
          .set({ activo: false })
          .where(eq(t.modulosAtencion.id, f.moduleId)),
      (f) =>
        db
          .update(t.asignaciones)
          .set({ canceladaEn: sql`UTC_TIMESTAMP(6)` })
          .where(eq(t.asignaciones.id, f.assignmentId)),
      (f) =>
        db
          .update(t.asignaciones)
          .set({ vigenteDesde: day(1) })
          .where(eq(t.asignaciones.id, f.assignmentId)),
      (f) =>
        db
          .update(t.asignaciones)
          .set({ vigenteHasta: day(-1) })
          .where(eq(t.asignaciones.id, f.assignmentId)),
    ]) {
      const f = await fixture();
      await change(f);
      expect((await capture(f)).status).toBe(403);
      expect(await marks(f)).toEqual([]);
      expect((await (await read(f)).json()).assignments).toEqual([]);
    }
    const a = await fixture(),
      b = await fixture();
    expect((await capture(a, 'check-in', { body: b.body })).status).toBe(403);
    expect(await marks(b)).toEqual([]);
  });
});

it('revalidates grants and profile eligibility between durable receipt and business commit', async () => {
  const f = await fixture(),
    original = persistence.complete.bind(persistence);
  const where = and(
    eq(t.rolPermisos.rolId, roles.OBSERVADOR),
    eq(t.rolPermisos.permisoId, permissions['attendance:capture-own']),
  );
  const spy = vi.spyOn(persistence, 'complete').mockImplementationOnce(async (...args) => {
    await db.delete(t.rolPermisos).where(where);
    return original(...args);
  });
  try {
    expect((await capture(f)).status).toBe(403);
  } finally {
    spy.mockRestore();
    await db
      .insert(t.rolPermisos)
      .values({ rolId: roles.OBSERVADOR, permisoId: permissions['attendance:capture-own'] });
  }
  expect((await receipts(f))[0].estado).toBe('pending');
  expect(await marks(f)).toEqual([]);
  const g = await fixture();
  const profileSpy = vi.spyOn(persistence, 'complete').mockImplementationOnce(async (...args) => {
    await db
      .update(t.observadores)
      .set({ activo: false })
      .where(eq(t.observadores.id, g.observerId));
    return original(...args);
  });
  try {
    expect((await capture(g)).status).toBe(403);
  } finally {
    profileSpy.mockRestore();
  }
  expect(await marks(g)).toEqual([]);
});

it('rolls back attendance, terminal receipt result and audit atomically, then retries with original content/time', async () => {
  const f = await fixture(),
    key = v7(),
    audit = await attendanceAudits();
  rootSql(
    `CREATE TRIGGER \`${database}\`.synthetic_capture_failure BEFORE INSERT ON \`${database}\`.auditoria FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic-private-location';`,
  );
  try {
    await at('09:00:00', async () => {
      const response = await capture(f, 'check-in', { key });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('synthetic-private-location');
    });
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_capture_failure;`);
  }
  expect(await marks(f)).toEqual([]);
  expect(await attendanceAudits()).toEqual(audit);
  expect((await receipts(f))[0]).toMatchObject({
    estado: 'pending',
    resultado: null,
    recibidoEn: scheduledInstant(today, '09:00:00'),
  });
  await at('10:00:00', async () => {
    const response = await capture(f, 'check-in', { key });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ state: 'accepted_automatic' });
  });
  expect((await marks(f))[0].registradoEn).toBe(scheduledInstant(today, '09:00:00'));
  expect(await attendanceAudits()).toHaveLength(audit.length + 1);
});

it('honors Mexico City midnight: rejects pending prior-day requests and permits completed replay without new marks', async () => {
  const f = await fixture(),
    key = v7();
  await at('09:00:00', async () =>
    expect((await capture(f, 'check-in', { key })).status).toBe(201),
  );
  const g = await fixture(),
    original = persistence.complete.bind(persistence),
    midnight = timestamp('00:00:00', day(1));
  await at(midnight - 1, async (clock) => {
    const spy = vi.spyOn(persistence, 'complete').mockImplementationOnce((...args) => {
      clock.mockReturnValue(midnight);
      return original(...args);
    });
    try {
      const response = await capture(g);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'day_changed' });
    } finally {
      spy.mockRestore();
    }
  });
  expect((await receipts(g))[0]).toMatchObject({ fechaLocal: today, estado: 'rejected' });
  expect(await marks(g)).toEqual([]);
  await at(midnight, async () => {
    const replay = await capture(f, 'check-in', { key });
    expect(replay.status).toBe(201);
    expect(await marks(f)).toHaveLength(1);
    expect((await (await read(f)).json()).date).toBe(day(1));
    const stale = await capture(await fixture());
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'day_changed' });
  });
});

it('isolates own history, bounds daily pagination and retains historical reads when capture resources close', async () => {
  const f = await fixture(),
    other = await fixture();
  await at('09:00:00', async () => {
    expect((await capture(f)).status).toBe(201);
    expect((await capture(other)).status).toBe(201);
  });
  await db.insert(t.registrosAsistencia).values({
    asignacionId: f.assignmentId,
    fechaAsistencia: day(-1),
    tipo: 'entrada',
    registradoEn: scheduledInstant(day(-1), '09:00:00'),
    registradoPor: admin.id,
    canal: 'manual',
    motivoCapturaManual: 'Synthetic historical capture',
    motivoSinUbicacion: 'unsupported',
    estado: 'accepted_administrative',
    politicaVersion: 'manual-v1',
    revisadoPor: admin.id,
    revisadoEn: receivedAt(Date.now()),
    motivoDecision: 'Synthetic approval',
  });
  const response = await read(f, '?page=1&limit=1');
  expect(response.status).toBe(200);
  const page = await response.json();
  expect(page).toMatchObject({
    total: 2,
    page: 1,
    limit: 1,
    items: [
      { assignmentId: f.assignmentId, date: today, completeness: 'check_in_only', checkOut: null },
    ],
  });
  expect(JSON.stringify(page)).not.toContain(other.assignmentId);
  expect((await (await read(f, '?page=2&limit=1')).json()).items[0].date).toBe(day(-1));
  expect((await (await read(f, `?from=${today}&to=${today}`)).json()).total).toBe(1);
  for (const query of [
    '?limit=101',
    '?page=0',
    '?page=1000001',
    '?from=2030-02-30',
    `?from=${today}&to=${day(-1)}`,
    `?observerId=${other.observerId}`,
    `?userId=${other.id}`,
  ])
    expect((await read(f, query)).status).toBe(400);
  await db
    .update(t.operativos)
    .set({ estado: 'cerrado' })
    .where(eq(t.operativos.id, f.operativeId));
  await db
    .update(t.modulosAtencion)
    .set({ activo: false })
    .where(eq(t.modulosAtencion.id, f.moduleId));
  expect((await (await read(f, '')).json()).total).toBe(2);
  await db.update(t.observadores).set({ activo: false }).where(eq(t.observadores.id, f.observerId));
  expect((await read(f, '')).status).toBe(403);
});
