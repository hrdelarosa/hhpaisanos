import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { v7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { loadDatabaseConfig } from '../dist/database/database.config.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { hashPassword } from '../dist/modules/auth/auth.service.js';
import { RequirePermissions } from '../dist/modules/auth/decorators/require-permissions.decorator.js';
import * as t from '../dist/database/schema/index.js';
import { rootSql } from './helpers/mysql.mjs';

class ProbeController {
  read() {
    return { allowed: true };
  }
}
Controller('api/auth-test')(ProbeController);
Get()(
  ProbeController.prototype,
  'read',
  Object.getOwnPropertyDescriptor(ProbeController.prototype, 'read'),
);
RequirePermissions('synthetic:read')(
  ProbeController.prototype,
  'read',
  Object.getOwnPropertyDescriptor(ProbeController.prototype, 'read'),
);
class TestModule {}
Module({ imports: [AppModule], controllers: [ProbeController] })(TestModule);

const database = `hhpaisanos_test_${randomBytes(8).toString('hex')}`;
const password = 'Synthetic password 🌵 123';
const origin = 'http://localhost:5173';
let app,
  db,
  baseUrl,
  originalDatabase,
  originalOrigins,
  created = false;
const roleIds = {};

beforeAll(async () => {
  const config = loadDatabaseConfig();
  if (
    config.host !== 'localhost' ||
    config.port !== 3306 ||
    config.database !== 'hhpaisanos' ||
    config.user !== 'hhpaisanos'
  ) {
    throw new Error('Integration tests require the documented localhost Compose configuration');
  }
  if (!rootSql('SELECT VERSION();').startsWith('8.4.')) throw new Error('MySQL 8.4 required');
  rootSql(
    `CREATE DATABASE \`${database}\`; GRANT ALL PRIVILEGES ON \`${database}\`.* TO 'hhpaisanos'@'%';`,
  );
  created = true;
  originalDatabase = process.env.DB_NAME;
  originalOrigins = process.env.AUTH_ORIGINS;
  process.env.DB_NAME = database;
  process.env.AUTH_ORIGINS = origin;
  const setup = new DatabaseService({ ...config, database });
  try {
    await setup.onModuleInit();
    await migrate(setup.db, { migrationsFolder: './drizzle' });
    for (const code of ['ADMIN', 'ENLACE', 'OBSERVADOR']) {
      roleIds[code] = v7();
      await setup.db
        .insert(t.roles)
        .values({ id: roleIds[code], codigo: code, nombre: code, activo: true });
    }
  } finally {
    await setup.onModuleDestroy();
  }
}, 60000);

beforeEach(async () => {
  await app?.close();
  app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
  await app.listen(0, 'localhost');
  baseUrl = await app.getUrl();
  db = app.get(DatabaseService).db;
}, 30000);

afterAll(async () => {
  try {
    await app?.close();
  } finally {
    if (originalDatabase === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = originalDatabase;
    if (originalOrigins === undefined) delete process.env.AUTH_ORIGINS;
    else process.env.AUTH_ORIGINS = originalOrigins;
    if (created)
      rootSql(
        `DROP DATABASE \`${database}\`; REVOKE ALL PRIVILEGES ON \`${database}\`.* FROM 'hhpaisanos'@'%';`,
      );
  }
}, 30000);

async function user(role = 'ADMIN', temporary = false) {
  const id = v7(),
    username = `synthetic-${id.slice(-12)}`;
  await db.insert(t.usuarios).values({
    id,
    rolId: roleIds[role],
    nombreUsuario: username,
    nombreCompleto: 'Synthetic user',
    passwordHash: await hashPassword(password),
    activo: true,
    debeCambiarPassword: temporary,
    intentosFallidos: 0,
  });
  return { id, username };
}

function request(path, { method = 'GET', cookie, body, csrf = true, requestOrigin = origin } = {}) {
  return fetch(`${baseUrl}/api/${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== 'GET'
        ? {
            'Content-Type': 'application/json',
            Origin: requestOrigin,
            ...(csrf ? { 'X-HHP-CSRF': '1' } : {}),
          }
        : {}),
    },
    body: method !== 'GET' ? JSON.stringify(body ?? {}) : undefined,
  });
}

async function login(account, suppliedPassword = password) {
  const response = await request('auth/login', {
    method: 'POST',
    body: { username: account.username, password: suppliedPassword },
  });
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

it('issues only hashed fixed-duration sessions for each role, expires them, and revokes logout idempotently', async () => {
  for (const [role, minutes] of [
    ['ADMIN', 30],
    ['ENLACE', 180],
    ['OBSERVADOR', 180],
  ]) {
    const account = await user(role);
    const { response, cookie } = await login(account);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true });
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Lax/i);
    const [session] = await db
      .select()
      .from(t.sesiones)
      .where(eq(t.sesiones.usuarioId, account.id));
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(cookie).not.toContain(session.tokenHash);
    expect(session.expiraPorInactividadEn).toBeNull();
    expect(
      new Date(session.expiraEnAbsoluto.replace(' ', 'T') + 'Z') -
        new Date(session.ultimaActividadEn.replace(' ', 'T') + 'Z'),
    ).toBe(minutes * 60000);
    expect((await request('auth/me', { cookie })).status).toBe(200);
    const [unchanged] = await db.select().from(t.sesiones).where(eq(t.sesiones.id, session.id));
    expect(unchanged).toEqual(session);
    await db
      .update(t.sesiones)
      .set({ expiraEnAbsoluto: sql`UTC_TIMESTAMP(6) - INTERVAL 1 SECOND` })
      .where(eq(t.sesiones.id, session.id));
    expect((await request('auth/me', { cookie })).status).toBe(401);
    const active = await login(account);
    expect((await request('auth/logout', { method: 'POST', cookie: active.cookie })).status).toBe(
      204,
    );
    expect((await request('auth/me', { cookie: active.cookie })).status).toBe(401);
    expect((await request('auth/logout', { method: 'POST', cookie: active.cookie })).status).toBe(
      204,
    );
  }
});

it('commits concurrent failures, locks once without extending, resets on expiry/success, and hides account state', async () => {
  const account = await user();
  const failures = await Promise.all(Array.from({ length: 5 }, () => login(account, 'wrong')));
  expect(failures.map(({ response }) => response.status)).toEqual([401, 401, 401, 401, 401]);
  const [locked] = await db.select().from(t.usuarios).where(eq(t.usuarios.id, account.id));
  expect(locked.intentosFallidos).toBe(5);
  expect(new Date(locked.bloqueadoHasta.replace(' ', 'T') + 'Z').getTime()).toBeGreaterThan(
    Date.now() + 14 * 60000,
  );
  const blocked = await login(account);
  const absent = await login({ username: 'nonexistent' });
  expect(await blocked.response.json()).toEqual(await absent.response.json());
  const [stillLocked] = await db.select().from(t.usuarios).where(eq(t.usuarios.id, account.id));
  expect(stillLocked.bloqueadoHasta).toBe(locked.bloqueadoHasta);
  await db
    .update(t.usuarios)
    .set({ bloqueadoHasta: sql`UTC_TIMESTAMP(6) - INTERVAL 1 SECOND` })
    .where(eq(t.usuarios.id, account.id));
  await login(account, 'wrong');
  const [reset] = await db.select().from(t.usuarios).where(eq(t.usuarios.id, account.id));
  expect(reset.intentosFallidos).toBe(1);
  expect(reset.bloqueadoHasta).toBeNull();
  expect((await login(account)).response.status).toBe(200);
  const [success] = await db.select().from(t.usuarios).where(eq(t.usuarios.id, account.id));
  expect(success.intentosFallidos).toBe(0);
});

it('enforces temporary credentials and live permissions/activity without an ADMIN bypass', async () => {
  const account = await user('OBSERVADOR', true);
  const { cookie } = await login(account);
  expect((await (await request('auth/me', { cookie })).json()).mustChangePassword).toBe(true);
  const required = await request('auth-test', { cookie });
  expect(required.status).toBe(403);
  expect((await required.json()).code).toBe('PASSWORD_CHANGE_REQUIRED');
  await db
    .update(t.usuarios)
    .set({ debeCambiarPassword: false })
    .where(eq(t.usuarios.id, account.id));
  expect((await request('auth-test', { cookie })).status).toBe(403);
  const permission = v7();
  await db.insert(t.permisos).values({ id: permission, codigo: 'synthetic:read' });
  await db.insert(t.rolPermisos).values({ rolId: roleIds.OBSERVADOR, permisoId: permission });
  expect((await request('auth-test', { cookie })).status).toBe(200);
  await db.delete(t.rolPermisos).where(eq(t.rolPermisos.permisoId, permission));
  expect((await request('auth-test', { cookie })).status).toBe(403);
  const admin = await login(await user());
  expect((await request('auth-test', { cookie: admin.cookie })).status).toBe(403);
  await db.update(t.roles).set({ activo: false }).where(eq(t.roles.id, roleIds.OBSERVADOR));
  expect((await request('auth/me', { cookie })).status).toBe(401);
  await db.update(t.roles).set({ activo: true }).where(eq(t.roles.id, roleIds.OBSERVADOR));
  await db.update(t.usuarios).set({ activo: false }).where(eq(t.usuarios.id, account.id));
  expect((await request('auth/me', { cookie })).status).toBe(401);
  expect((await login(account)).response.status).toBe(401);
});

it('rejects CSRF and enforces password rules, persistent verification throttling and all-session revocation', async () => {
  const account = await user('ENLACE', true);
  expect(
    (
      await request('auth/login', {
        method: 'POST',
        csrf: false,
        body: { username: account.username, password },
      })
    ).status,
  ).toBe(403);
  const first = await login(account),
    second = await login(account);
  const change = (cookie, body, extra = {}) =>
    request('auth/change-password', { method: 'POST', cookie, body, ...extra });
  const newPassword = '  Nueva contraseña 🌵 segura  ';
  expect(
    (
      await request('auth/logout', {
        method: 'POST',
        cookie: first.cookie,
        requestOrigin: 'https://attacker.invalid',
      })
    ).status,
  ).toBe(403);
  expect(
    (await change(first.cookie, { currentPassword: password, newPassword }, { csrf: false }))
      .status,
  ).toBe(403);
  expect(
    (await change(first.cookie, { currentPassword: password, newPassword: 'short' })).status,
  ).toBe(400);
  expect(
    (await change(first.cookie, { currentPassword: password, newPassword: password })).status,
  ).toBe(400);
  const limited = await user('ENLACE');
  const limitedLogin = await login(limited);
  const attempts = await Promise.all(
    Array.from({ length: 6 }, () =>
      change(limitedLogin.cookie, { currentPassword: 'wrong', newPassword }),
    ),
  );
  expect(attempts.map((r) => r.status).sort((a, b) => a - b)).toEqual([
    401, 401, 401, 401, 401, 429,
  ]);
  expect(
    (await change(limitedLogin.cookie, { currentPassword: password, newPassword })).status,
  ).toBe(429);
  // Race a successful password change against old-credential login: no old session may survive.
  const [changed] = await Promise.all([
    change(first.cookie, { currentPassword: password, newPassword }),
    login(account),
  ]);
  expect(changed.status).toBe(204);
  expect(changed.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970');
  expect((await request('auth/me', { cookie: first.cookie })).status).toBe(401);
  expect((await request('auth/me', { cookie: second.cookie })).status).toBe(401);
  const sessions = await db.select().from(t.sesiones).where(eq(t.sesiones.usuarioId, account.id));
  expect(sessions.every((s) => s.revocadaEn !== null)).toBe(true);
  expect((await login(account)).response.status).toBe(401);
  const fresh = await login(account, newPassword);
  expect(fresh.response.status).toBe(200);
  expect(
    (await (await request('auth/me', { cookie: fresh.cookie })).json()).mustChangePassword,
  ).toBe(false);
  const events = await db.select().from(t.auditoria).where(eq(t.auditoria.usuarioId, account.id));
  expect(events.filter((e) => e.accion === 'auth.password.changed')).toHaveLength(1);
  expect(events.filter((e) => e.accion === 'auth.session.revoked')).toHaveLength(sessions.length);
  const serialized = JSON.stringify(events);
  expect(serialized).not.toContain(password);
  expect(serialized).not.toContain(newPassword);
  expect(serialized).not.toContain('$argon2');
});

it('rolls back password updates and revocations if audit insertion fails, without exposing driver secrets', async () => {
  const account = await user();
  const { cookie } = await login(account);
  rootSql(
    `CREATE TRIGGER \`${database}\`.synthetic_audit_failure BEFORE INSERT ON \`${database}\`.auditoria FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic-secret-error';`,
  );
  try {
    const response = await request('auth/change-password', {
      method: 'POST',
      cookie,
      body: { currentPassword: password, newPassword: 'Another synthetic password 123' },
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('synthetic-secret-error');
    expect((await request('auth/me', { cookie })).status).toBe(200);
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_audit_failure;`);
  }
  expect((await login(account)).response.status).toBe(200);
  const events = await db
    .select()
    .from(t.auditoria)
    .where(
      and(eq(t.auditoria.usuarioId, account.id), eq(t.auditoria.accion, 'auth.password.changed')),
    );
  expect(events).toHaveLength(0);
  // Exercise the bounded IP backstop without performing expensive password hashing.
  const attempts = await Promise.all(
    Array.from({ length: 31 }, () => request('auth/login', { method: 'POST', body: {} })),
  );
  expect(attempts.some((r) => r.status === 429 && r.headers.has('Retry-After'))).toBe(true);
});
