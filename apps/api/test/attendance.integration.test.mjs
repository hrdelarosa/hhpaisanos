import 'reflect-metadata';
import { randomBytes, createHash } from 'node:crypto';
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
import { NestFactory } from '@nestjs/core';
import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { v7 } from 'uuid';
import { afterAll, beforeAll, expect, it, vi } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { AuthService } from '../dist/modules/auth/auth.service.js';
import { AssignmentsService } from '../dist/modules/assignments/assignments.service.js';
import { AttendancePersistence } from '../dist/modules/attendance/attendance.persistence.js';
import {
  localDate,
  receivedAt,
  scheduledInstant,
} from '../dist/modules/attendance/attendance-time.js';
import * as t from '../dist/database/schema/index.js';
import { rootSql } from './helpers/mysql.mjs';

const suffix = randomBytes(8).toString('hex');
const database = `hhpaisanos_test_${suffix}`;
const runtimeUser = `hhp_test_${suffix}`;
const runtimePassword = randomBytes(24).toString('hex');
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
const boundary = scheduledInstant(today, '09:15:00').replace('.000000', '.123000');
const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
let app,
  service,
  db,
  assignments,
  admin,
  observerRole,
  databaseCreated = false,
  userCreated = false,
  upgradedAssignment;
const config = {
  host: 'localhost',
  port: 3306,
  database,
  user: runtimeUser,
  password: runtimePassword,
  connectionLimit: 8,
};

function day(offset) {
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

async function account(roleId, permissions = []) {
  const id = v7(),
    sessionId = v7();
  await db.insert(t.usuarios).values({
    id,
    rolId: roleId,
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
    tokenHash: randomBytes(32).toString('hex'),
    ultimaActividadEn: boundary,
    expiraEnAbsoluto: `${day(30)} 23:59:59.000000`,
  });
  return {
    sessionId,
    user: { id, role: roleId === observerRole ? 'OBSERVADOR' : 'ADMIN', permissions },
  };
}

async function fixture(from = day(-5), to = day(20), accredited = true) {
  const context = await account(observerRole);
  const [{ id: operativeId }] = await db
    .insert(t.operativos)
    .values({
      nombre: `Synthetic ${v7()}`,
      fechaInicio: day(-30),
      fechaFin: day(60),
      estado: 'activo',
      toleranciaMinutos: 15,
    })
    .$returningId();
  const [{ id: observerId }] = await db
    .insert(t.observadores)
    .values({
      nombres: 'Synthetic',
      apellidos: 'Observer',
      usuarioId: context.user.id,
      activo: true,
    })
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
      vigenteDesde: from,
      vigenteHasta: to,
      horaInicio: '09:00:00',
      horaFin: '17:00:00',
      creadoPor: admin.user.id,
    })
    .$returningId();
  if (accredited)
    await db.insert(t.auditoria).values({
      usuarioId: admin.user.id,
      sesionId: admin.sessionId,
      tipoEntidad: 'observadores',
      entidadId: observerId,
      accion: 'observers.account.linked',
      valoresNuevos: { userId: context.user.id, verificationMethod: 'supervised_administrative' },
    });
  const input = {
    assignmentId,
    expectedDate: today,
    type: 'entrada',
    location: { latitude: 16.85, longitude: -99.9, accuracy: 0 },
  };
  return { context, operativeId, observerId, moduleId, assignmentId, input };
}

async function establish(f, key = v7(), input = f.input, timestamp = boundary) {
  return service.establish(f.context, key, input, timestamp);
}
async function receipt(id) {
  return (await db.select().from(t.recibosAsistencia).where(eq(t.recibosAsistencia.id, id)))[0];
}
async function marks(id) {
  return db.select().from(t.registrosAsistencia).where(eq(t.registrosAsistencia.asignacionId, id));
}
async function audits(id) {
  return db
    .select()
    .from(t.auditoria)
    .where(and(eq(t.auditoria.tipoEntidad, 'registros_asistencia'), eq(t.auditoria.entidadId, id)));
}
async function rejectsCode(work, code) {
  try {
    await work;
  } catch (error) {
    expect((error.cause ?? error).code).toBe(code);
    return;
  }
  expect.fail(`Expected MySQL ${code}`);
}
function manual(f, date = today, overrides = {}) {
  return {
    asignacionId: f.assignmentId,
    fechaAsistencia: date,
    tipo: 'entrada',
    registradoEn: scheduledInstant(date, '09:00:00'),
    registradoPor: admin.user.id,
    canal: 'manual',
    motivoCapturaManual: 'Synthetic historical record',
    motivoSinUbicacion: 'unsupported',
    estado: 'accepted_administrative',
    politicaVersion: 'manual-v1',
    revisadoPor: admin.user.id,
    revisadoEn: boundary,
    motivoDecision: 'Authorized synthetic record',
    ...overrides,
  };
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
  const setup = new DatabaseService(config);
  await setup.onModuleInit();
  db = setup.db;
  const folder = mkdtempSync(join(tmpdir(), 'hhp-attendance-'));
  const entries = journal.entries.slice(0, 3);
  mkdirSync(join(folder, 'meta'));
  writeFileSync(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }));
  for (const entry of entries)
    copyFileSync(`drizzle/${entry.tag}.sql`, join(folder, `${entry.tag}.sql`));
  try {
    await migrate(db, { migrationsFolder: folder });
    const [{ id: adminRole }] = await db
      .insert(t.roles)
      .values({ codigo: 'ADMIN', nombre: 'Synthetic admin', activo: true })
      .$returningId();
    [{ id: observerRole }] = await db
      .insert(t.roles)
      .values({ codigo: 'OBSERVADOR', nombre: 'Synthetic observer', activo: true })
      .$returningId();
    const [{ id: capture }] = await db
      .insert(t.permisos)
      .values({ codigo: 'attendance:capture-own' })
      .$returningId();
    await db.insert(t.rolPermisos).values({ rolId: observerRole, permisoId: capture });
    // Synthetic grants only, never shared permission provisioning.
    for (const code of ['assignments:update', 'assignments:cancel']) {
      const [{ id }] = await db.insert(t.permisos).values({ codigo: code }).$returningId();
      await db.insert(t.rolPermisos).values({ rolId: adminRole, permisoId: id });
    }
    admin = await account(adminRole);
    upgradedAssignment = await fixture();
    const before = await db.select().from(t.asignaciones);
    await migrate(db, { migrationsFolder: './drizzle' });
    expect(await db.select().from(t.asignaciones)).toEqual(before);
  } finally {
    await setup.onModuleDestroy();
    for (const entry of entries) unlinkSync(join(folder, `${entry.tag}.sql`));
    unlinkSync(join(folder, 'meta/_journal.json'));
    rmdirSync(join(folder, 'meta'));
    rmdirSync(folder);
  }
  Object.assign(process.env, {
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_NAME: database,
    DB_USER: runtimeUser,
    DB_PASSWORD: runtimePassword,
    AUTH_ORIGINS: 'http://localhost:5173',
  });
  app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  db = app.get(DatabaseService).db;
  service = app.get(AttendancePersistence);
  assignments = app.get(AssignmentsService);
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

it('upgrades populated assignments additively and leaves previous migration hashes unchanged', async () => {
  expect(await marks(upgradedAssignment.assignmentId)).toEqual([]);
  const [applied] = await db.execute(
    sql`SELECT hash FROM __drizzle_migrations ORDER BY created_at`,
  );
  const expected = [
    'ef7ce2e2b7b3692b4f4291ce4f4970a3710a549248d50a5368fb87f569e91d36',
    '8ae9a51222484242dbdcea9236449df2fd8b138cc42c803d7e7e9cd5abc645a0',
    '4ddab22089ccd5e36782f272aaab0f21d31c13b8b02a7f3c472f049d2ee1263c',
  ];
  expect(applied.slice(0, 3).map((r) => r.hash)).toEqual(expected);
  expect(
    journal.entries.slice(0, 3).map((entry) =>
      createHash('sha256')
        .update(readFileSync(`drizzle/${entry.tag}.sql`))
        .digest('hex'),
    ),
  ).toEqual(expected);
});

it('concurrent identical keys commit one immutable original receipt, exact case-sensitive scope', async () => {
  const f = await fixture(),
    key = 'Exact-Key';
  const ids = await Promise.all([
    establish(f, key),
    establish(
      f,
      key,
      { ...f.input, location: { accuracy: 0, longitude: -99.9, latitude: 16.85 } },
      boundary.replace('.123000', '.999000'),
    ),
  ]);
  expect(ids[0]).toBe(ids[1]);
  const row = await receipt(ids[0]);
  expect([boundary, boundary.replace('.123000', '.999000')]).toContain(row.recibidoEn);
  expect(row.recibidoEn).toMatch(/\.\d{3}000$/);
  expect(row.estado).toBe('pending');
  expect(row.resultado).toBeNull();
  await establish(f, key, f.input, boundary.replace('.123000', '.456000'));
  expect(await receipt(ids[0])).toEqual(row);
  await rejectsCode(db.insert(t.recibosAsistencia).values({ ...row, id: v7() }), 'ER_DUP_ENTRY');
  await rejectsCode(
    db
      .update(t.recibosAsistencia)
      .set({ estado: 'completed', resultado: null })
      .where(eq(t.recibosAsistencia.id, ids[0])),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  await rejectsCode(
    db
      .update(t.recibosAsistencia)
      .set({ estado: 'pending', resultado: { code: 'ineligible' } })
      .where(eq(t.recibosAsistencia.id, ids[0])),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  expect(await establish(f, 'exact-key')).not.toBe(ids[0]);
  const other = await fixture();
  expect(await establish(other, key)).not.toBe(ids[0]);
  await expect(establish(f, key, { ...f.input, type: 'salida' })).rejects.toThrow(
    'Idempotency key content conflict',
  );
  expect(await receipt(ids[0])).toEqual(row);
});

it('concurrent same key with different validated content conflicts; invalid input establishes nothing', async () => {
  const f = await fixture(),
    key = v7();
  const results = await Promise.allSettled([
    establish(f, key),
    establish(f, key, { ...f.input, type: 'salida' }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((r) => r.status === 'rejected').reason.getStatus()).toBe(409);
  await expect(
    establish(f, key, { ...f.input, location: { latitude: 91, longitude: 0, accuracy: 1 } }),
  ).rejects.toThrow('Invalid attendance content');
  const rows = await db
    .select()
    .from(t.recibosAsistencia)
    .where(eq(t.recibosAsistencia.usuarioId, f.context.user.id));
  expect(rows).toHaveLength(1);
});

it('receipt survives the process gap and a new connection can complete it using the original timestamp', async () => {
  const f = await fixture(),
    id = await establish(f);
  expect(await marks(f.assignmentId)).toEqual([]);
  const recoveredDb = new DatabaseService(config);
  await recoveredDb.onModuleInit();
  try {
    const recovered = new AttendancePersistence(recoveredDb, app.get(AuthService));
    const result = await recovered.complete(f.context, id);
    expect((await marks(f.assignmentId))[0].registradoEn).toBe(boundary);
    expect((await receipt(id)).resultado).toEqual(result);
    expect(await audits(result.attendanceId)).toHaveLength(1);
  } finally {
    await recoveredDb.onModuleDestroy();
  }
});

it('audit failure rolls back attendance and terminal result; retry and lost-response replay audit exactly once', async () => {
  const f = await fixture(),
    id = await establish(f);
  rootSql(
    `CREATE TRIGGER \`${database}\`.synthetic_audit_failure BEFORE INSERT ON \`${database}\`.auditoria FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Synthetic audit error';`,
  );
  try {
    await expect(service.complete(f.context, id)).rejects.toThrow('Attendance persistence failed');
    expect(await marks(f.assignmentId)).toHaveLength(0);
    expect((await receipt(id)).estado).toBe('pending');
    expect((await receipt(id)).recibidoEn).toBe(boundary);
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_audit_failure;`);
  }
  const result = await service.complete(f.context, id);
  const replay = await Promise.all([
    service.complete(f.context, id),
    service.complete(f.context, id),
  ]);
  expect(replay).toEqual([result, result]);
  expect(await marks(f.assignmentId)).toHaveLength(1);
  expect(await audits(result.attendanceId)).toHaveLength(1);
  expect(JSON.stringify((await audits(result.attendanceId))[0].valoresNuevos)).not.toMatch(
    /latitude|longitude|accuracy|16\.85|-99\.9/,
  );
  expect(Object.keys(result).sort()).toEqual(['attendanceId', 'state']);
  const terminal = await receipt(id);
  expect(await establish(f, terminal.clave)).toBe(id);
  expect(await receipt(id)).toEqual(terminal);
});

it('distinct keys cannot duplicate initial marks or silently create version 2', async () => {
  const f = await fixture();
  const ids = await Promise.all([establish(f), establish(f)]);
  const result = await Promise.all(ids.map((id) => service.complete(f.context, id)));
  expect(result.filter((r) => r.attendanceId)).toHaveLength(1);
  expect(result).toContainEqual({ code: 'initial_mark_exists' });
  expect(await marks(f.assignmentId)).toHaveLength(1);
  expect((await marks(f.assignmentId))[0].version).toBe(1);
});

it('a real lock timeout rolls back business work and preserves the durable receipt for retry', async () => {
  const f = await fixture(),
    id = await establish(f);
  const isolated = new DatabaseService({ ...config, connectionLimit: 1 });
  await isolated.onModuleInit();
  await isolated.db.execute(sql`SET SESSION innodb_lock_wait_timeout = 1`);
  const contender = new AttendancePersistence(isolated, app.get(AuthService));
  let unlock, locked;
  const gate = new Promise((resolve) => {
    unlock = resolve;
  });
  const ready = new Promise((resolve) => {
    locked = resolve;
  });
  const holder = db.transaction(async (tx) => {
    await tx.select().from(t.observadores).where(eq(t.observadores.id, f.observerId)).for('update');
    locked();
    await gate;
  });
  await ready;
  try {
    await expect(contender.complete(f.context, id)).rejects.toThrow(
      'Concurrent attendance operation',
    );
    expect((await receipt(id)).estado).toBe('pending');
    expect((await receipt(id)).recibidoEn).toBe(boundary);
    expect(await marks(f.assignmentId)).toHaveLength(0);
  } finally {
    unlock();
    await holder;
    await isolated.onModuleDestroy();
  }
  expect((await service.complete(f.context, id)).attendanceId).toBeDefined();
  expect((await marks(f.assignmentId))[0].registradoEn).toBe(boundary);
});

it('renews sessions within the user scope but revalidates current permission and server-resolved linkage', async () => {
  const f = await fixture(),
    key = v7(),
    id = await establish(f, key);
  const sessionId = v7();
  await db.insert(t.sesiones).values({
    id: sessionId,
    usuarioId: f.context.user.id,
    tokenHash: randomBytes(32).toString('hex'),
    ultimaActividadEn: boundary,
    expiraEnAbsoluto: `${day(30)} 23:59:59.000000`,
  });
  await db
    .update(t.sesiones)
    .set({ revocadaEn: boundary })
    .where(eq(t.sesiones.id, f.context.sessionId));
  await expect(service.complete(f.context, id)).rejects.toThrow('Authentication required');
  const renewed = { ...f.context, sessionId };
  expect(await service.establish(renewed, key, f.input, boundary)).toBe(id);
  expect((await receipt(id)).sesionId).toBe(f.context.sessionId);
  const result = await service.complete(renewed, id);
  expect(result.attendanceId).toBeDefined();
  await db.update(t.observadores).set({ activo: false }).where(eq(t.observadores.id, f.observerId));
  await expect(service.complete(renewed, id)).rejects.toThrow('Observer is not eligible');
  await db.update(t.observadores).set({ activo: true }).where(eq(t.observadores.id, f.observerId));
  expect(await service.complete(renewed, id)).toEqual(result);
  const unverified = await fixture(undefined, undefined, false);
  const pending = await establish(unverified);
  expect(await service.complete(unverified.context, pending)).toEqual({ code: 'ineligible' });
  await expect(service.establish(admin, v7(), f.input, boundary)).rejects.toThrow(
    'Insufficient permissions',
  );
  const foreign = await fixture();
  await expect(service.complete(foreign.context, id)).rejects.toThrow('Receipt not found');
  const [grant] = await db
    .select()
    .from(t.rolPermisos)
    .where(eq(t.rolPermisos.rolId, observerRole));
  await db
    .delete(t.rolPermisos)
    .where(and(eq(t.rolPermisos.rolId, grant.rolId), eq(t.rolPermisos.permisoId, grant.permisoId)));
  try {
    await expect(service.complete(renewed, id)).rejects.toThrow('Insufficient permissions');
  } finally {
    await db.insert(t.rolPermisos).values(grant);
  }
});

it('current operative, observer, module and historical assignment eligibility are checked after receipt commit', async () => {
  for (const resource of ['operative', 'observer', 'module', 'assignment']) {
    const f = await fixture(),
      id = await establish(f);
    if (resource === 'operative')
      await db
        .update(t.operativos)
        .set({ estado: 'cerrado' })
        .where(eq(t.operativos.id, f.operativeId));
    if (resource === 'observer')
      await db
        .update(t.observadores)
        .set({ activo: false })
        .where(eq(t.observadores.id, f.observerId));
    if (resource === 'module')
      await db
        .update(t.modulosAtencion)
        .set({ activo: false })
        .where(eq(t.modulosAtencion.id, f.moduleId));
    if (resource === 'assignment')
      await db
        .update(t.asignaciones)
        .set({ vigenteDesde: day(1) })
        .where(eq(t.asignaciones.id, f.assignmentId));
    expect(await service.complete(f.context, id)).toEqual({ code: 'ineligible' });
    expect((await receipt(id)).estado).toBe('rejected');
    expect(await marks(f.assignmentId)).toHaveLength(0);
  }
});

it('pending old-day and midnight-crossing requests reject without shifting dates; completed replay after midnight succeeds', async () => {
  const f = await fixture(),
    id = await establish(f);
  const result = await service.complete(f.context, id);
  const pending = await establish(f, v7(), { ...f.input, type: 'salida' });
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(`${day(1)}T06:00:00.000Z`));
  try {
    expect(await service.complete(f.context, pending)).toEqual({ code: 'day_changed' });
    expect(await service.complete(f.context, id)).toEqual(result);
    expect((await receipt(pending)).recibidoEn).toBe(boundary);
  } finally {
    clock.mockRestore();
  }
  const old = await fixture();
  const oldInput = { ...old.input, expectedDate: day(-1) };
  const oldReceipt = await establish(old, v7(), oldInput, scheduledInstant(day(-1), '23:59:59'));
  expect(await service.complete(old.context, oldReceipt)).toEqual({ code: 'day_changed' });
  const mismatch = await establish(old, v7(), { ...old.input, expectedDate: day(1) });
  expect(await service.complete(old.context, mismatch)).toEqual({ code: 'day_changed' });
  expect(await marks(old.assignmentId)).toHaveLength(0);
});

it('checks midnight after a real observer-lock wait before inserting', async () => {
  const f = await fixture(),
    id = await establish(f);
  let unlock, locked;
  const gate = new Promise((resolve) => {
    unlock = resolve;
  });
  const ready = new Promise((resolve) => {
    locked = resolve;
  });
  const holder = db.transaction(async (tx) => {
    await tx.select().from(t.observadores).where(eq(t.observadores.id, f.observerId)).for('update');
    locked();
    await gate;
  });
  await ready;
  const pending = service.complete(f.context, id);
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(`${day(1)}T06:00:00.000Z`));
  try {
    unlock();
    await holder;
    expect(await pending).toEqual({ code: 'day_changed' });
  } finally {
    unlock();
    clock.mockRestore();
  }
  expect(await marks(f.assignmentId)).toHaveLength(0);
});

it('GPS, review, correction provenance and current/version constraints hold; decisions preserve original evidence', async () => {
  const f = await fixture();
  const personalReceipt = await establish(f);
  for (const overrides of [
    { latitud: '0' },
    { latitud: '91', longitud: '0', precisionM: '1', motivoSinUbicacion: null },
    { latitud: '0', longitud: '181', precisionM: '1', motivoSinUbicacion: null },
    { latitud: '0', longitud: '0', precisionM: '-1', motivoSinUbicacion: null },
    { latitud: '0', longitud: '0', precisionM: '0' },
    { motivoSinUbicacion: null },
    { motivoSinUbicacion: 'other' },
    { version: 0 },
    { vigente: 0 },
    { tipo: 'other' },
    { estado: 'verificada' },
    { revisadoPor: null },
    { motivoCapturaManual: '' },
  ])
    await rejectsCode(
      db.insert(t.registrosAsistencia).values(manual(f, today, overrides)),
      'ER_CHECK_CONSTRAINT_VIOLATED',
    );
  const [{ id }] = await db.insert(t.registrosAsistencia).values(manual(f)).$returningId();
  await rejectsCode(db.insert(t.registrosAsistencia).values(manual(f)), 'ER_DUP_ENTRY');
  const original = (await marks(f.assignmentId))[0];
  await rejectsCode(
    db.insert(t.registrosAsistencia).values(manual(f, day(1), { reciboId: personalReceipt })),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  const correction = manual(f, today, {
    version: 2,
    anteriorId: id,
    motivoCorreccion: 'Synthetic correction',
    estado: 'pending_review',
    revisadoPor: null,
    revisadoEn: null,
    motivoDecision: null,
  });
  await rejectsCode(
    db.insert(t.registrosAsistencia).values({
      ...correction,
      estado: 'accepted_automatic',
      motivoSinUbicacion: null,
      latitud: '0',
      longitud: '0',
      precisionM: '0',
    }),
    'ER_CHECK_CONSTRAINT_VIOLATED',
  );
  await rejectsCode(db.insert(t.registrosAsistencia).values(correction), 'ER_DUP_ENTRY');
  await db
    .update(t.registrosAsistencia)
    .set({ vigente: null })
    .where(eq(t.registrosAsistencia.id, id));
  const [{ id: next }] = await db.insert(t.registrosAsistencia).values(correction).$returningId();
  await rejectsCode(db.insert(t.registrosAsistencia).values(correction), 'ER_DUP_ENTRY');
  await rejectsCode(
    db.update(t.registrosAsistencia).set({ vigente: 1 }).where(eq(t.registrosAsistencia.id, id)),
    'ER_DUP_ENTRY',
  );
  const other = await fixture();
  await rejectsCode(
    db
      .insert(t.registrosAsistencia)
      .values(
        manual(other, today, { ...correction, asignacionId: other.assignmentId, anteriorId: v7() }),
      ),
    'ER_NO_REFERENCED_ROW_2',
  );
  await db
    .update(t.registrosAsistencia)
    .set({
      estado: 'accepted_administrative',
      revisadoPor: admin.user.id,
      revisadoEn: boundary,
      motivoDecision: 'Explicit synthetic decision',
    })
    .where(eq(t.registrosAsistencia.id, next));
  expect((await marks(f.assignmentId)).find((r) => r.id === id)).toEqual({
    ...original,
    vigente: null,
  });
});

it('late arrival and missing location coexist; inclusive threshold auto-accepts and optional selfie is absent', async () => {
  const f = await fixture();
  const id = await establish(f, v7(), {
    ...f.input,
    location: { missingReason: 'permission_denied' },
  });
  expect((await service.complete(f.context, id)).state).toBe('pending_review');
  const [row] = await marks(f.assignmentId);
  expect(row.llegadaTardia).toBe(1);
  expect(row.motivoSinUbicacion).toBe('permission_denied');
  const normal = await fixture();
  const normalId = await establish(normal, v7(), normal.input, scheduledInstant(today, '09:15:00'));
  expect((await service.complete(normal.context, normalId)).state).toBe('accepted_automatic');
  const early = await establish(normal, v7(), {
    ...normal.input,
    type: 'salida',
    location: { missingReason: 'timeout' },
  });
  await service.complete(normal.context, early);
  const exit = (await marks(normal.assignmentId)).find((r) => r.tipo === 'salida');
  expect(exit.salidaTemprana).toBe(1);
  expect(exit.motivoSinUbicacion).toBe('timeout');
});

it('a personal original owns its unique receipt; correction provenance follows the predecessor without reusing that FK', async () => {
  const f = await fixture(),
    id = await establish(f);
  const result = await service.complete(f.context, id);
  const [original] = await marks(f.assignmentId);
  const other = await fixture();
  await rejectsCode(
    db
      .insert(t.registrosAsistencia)
      .values({ ...original, id: v7(), asignacionId: other.assignmentId }),
    'ER_DUP_ENTRY',
  );
  await db.transaction(async (tx) => {
    await tx
      .update(t.registrosAsistencia)
      .set({ vigente: null })
      .where(eq(t.registrosAsistencia.id, original.id));
    await tx.insert(t.registrosAsistencia).values({
      ...original,
      id: v7(),
      version: 2,
      vigente: 1,
      anteriorId: original.id,
      reciboId: null,
      motivoCorreccion: 'Synthetic personal correction',
      estado: 'pending_review',
    });
  });
  const history = await marks(f.assignmentId);
  const corrected = history.find((row) => row.version === 2);
  expect(corrected.reciboId).toBeNull();
  expect(corrected.anteriorId).toBe(original.id);
  expect(history.find((row) => row.id === corrected.anteriorId).reciboId).toBe(id);
  expect(await service.complete(f.context, id)).toEqual(result);
  expect(await audits(original.id)).toHaveLength(1);
  const duplicate = await establish(f);
  expect(await service.complete(f.context, duplicate)).toEqual({ code: 'initial_mark_exists' });
});

it('stores supplied six-digit event instants exactly and preserves them when decision fields change', async () => {
  const f = await fixture();
  const precise = scheduledInstant(today, '09:15:00').replace('.000000', '.000001');
  const [{ id }] = await db
    .insert(t.registrosAsistencia)
    .values(
      manual(f, today, {
        registradoEn: precise,
        estado: 'pending_review',
        revisadoPor: null,
        revisadoEn: null,
        motivoDecision: null,
      }),
    )
    .$returningId();
  expect((await marks(f.assignmentId))[0].registradoEn).toBe(precise);
  await db
    .update(t.registrosAsistencia)
    .set({
      estado: 'accepted_administrative',
      revisadoPor: admin.user.id,
      revisadoEn: boundary,
      motivoDecision: 'Synthetic explicit review',
    })
    .where(eq(t.registrosAsistencia.id, id));
  expect((await marks(f.assignmentId))[0].registradoEn).toBe(precise);
});

it('assignment termination, split and cancellation preserve every historical version, including annulled marks', async () => {
  const f = await fixture();
  await db.insert(t.registrosAsistencia).values(manual(f, day(10), { estado: 'annulled' }));
  await expect(
    assignments.modify(
      f.assignmentId,
      { expectedVersion: 1, lastValidDate: day(5), reason: 'Synthetic' },
      'terminate',
      admin,
    ),
  ).rejects.toThrow('invalidate historical attendance');
  await expect(
    assignments.modify(
      f.assignmentId,
      { expectedVersion: 1, effectiveFrom: day(5), startTime: '10:00:00', reason: 'Synthetic' },
      'change',
      admin,
    ),
  ).rejects.toThrow('invalidate historical attendance');
  const future = await fixture(day(2));
  await db.insert(t.registrosAsistencia).values(manual(future, day(10)));
  await expect(
    assignments.modify(
      future.assignmentId,
      { expectedVersion: 1, reason: 'Synthetic' },
      'cancel',
      admin,
    ),
  ).rejects.toThrow('invalidate historical attendance');
  await expect(
    assignments.modify(
      future.assignmentId,
      { expectedVersion: 1, effectiveFrom: day(2), startTime: '10:00:00', reason: 'Synthetic' },
      'change',
      admin,
    ),
  ).rejects.toThrow('invalidate historical attendance');
  await assignments.modify(
    f.assignmentId,
    { expectedVersion: 1, lastValidDate: day(10), reason: 'Preserve inclusive boundary' },
    'terminate',
    admin,
  );
  expect((await marks(f.assignmentId))[0].asignacionId).toBe(f.assignmentId);
});

it('a pending receipt does not pin scheduling; eligibility is revalidated after cancellation', async () => {
  const f = await fixture(day(2)),
    id = await establish(f);
  await assignments.modify(
    f.assignmentId,
    { expectedVersion: 1, reason: 'Synthetic cancellation' },
    'cancel',
    admin,
  );
  expect(await service.complete(f.context, id)).toEqual({ code: 'ineligible' });
});

it('compatible observer/assignment locks serialize history insertion against shortening', async () => {
  const f = await fixture();
  let unlock, locked;
  const gate = new Promise((resolve) => {
    unlock = resolve;
  });
  const ready = new Promise((resolve) => {
    locked = resolve;
  });
  const writer = db.transaction(async (tx) => {
    await app.get(AuthService).requireCurrentContext(tx, f.context);
    await tx.select().from(t.operativos).where(eq(t.operativos.id, f.operativeId)).for('share');
    await tx.select().from(t.observadores).where(eq(t.observadores.id, f.observerId)).for('update');
    await tx
      .select()
      .from(t.modulosAtencion)
      .where(eq(t.modulosAtencion.id, f.moduleId))
      .for('share');
    await tx
      .select()
      .from(t.asignaciones)
      .where(eq(t.asignaciones.id, f.assignmentId))
      .for('update');
    await tx.insert(t.registrosAsistencia).values(manual(f, day(10)));
    locked();
    await gate;
  });
  await ready;
  const mutation = assignments.modify(
    f.assignmentId,
    { expectedVersion: 1, lastValidDate: day(5), reason: 'Synthetic race' },
    'terminate',
    admin,
  );
  const outcome = mutation.catch((error) => error);
  unlock();
  await writer;
  expect((await outcome).message).toContain('invalidate historical attendance');
  expect(
    (await db.select().from(t.asignaciones).where(eq(t.asignaciones.id, f.assignmentId)))[0]
      .vigenteHasta,
  ).toBe(day(20));
});

it('real personal capture racing termination retains valid history without duplicate initial marks', async () => {
  const f = await fixture(),
    id = await establish(f);
  const [result] = await Promise.all([
    service.complete(f.context, id),
    assignments.modify(
      f.assignmentId,
      { expectedVersion: 1, lastValidDate: today, reason: 'Synthetic concurrent termination' },
      'terminate',
      admin,
    ),
  ]);
  expect(result.attendanceId).toBeDefined();
  expect(await marks(f.assignmentId)).toHaveLength(1);
  expect(
    (await db.select().from(t.asignaciones).where(eq(t.asignaciones.id, f.assignmentId)))[0]
      .vigenteHasta,
  ).toBe(today);
});
