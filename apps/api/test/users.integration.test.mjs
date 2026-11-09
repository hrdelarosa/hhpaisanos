import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { v7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vite-plus/test';
import { AppModule } from '../dist/app.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { loadDatabaseConfig } from '../dist/database/database.config.js';
import { AuthService, hashPassword } from '../dist/modules/auth/auth.service.js';
import { UsersService } from '../dist/modules/users/users.service.js';
import * as t from '../dist/database/schema/index.js';
import {
  approvedPermissions,
  provisionUsersPermissions,
} from '../tools/provision-users-permissions.mjs';
import { rootSql } from './helpers/mysql.mjs';

const database = `hhpaisanos_test_${randomBytes(8).toString('hex')}`;
const origin = 'http://localhost:5173';
const password = 'Synthetic password 🌵 123';
const roleIds = {};
const operationalPermissions = [
  'operatives:read',
  'operatives:create',
  'observers:read',
  'observers:create',
  'observers:update',
  'observers:change-status',
  'attention-modules:read',
  'attention-modules:create',
  'attention-modules:update',
  'attention-modules:change-status',
];
let app, db, baseUrl, dbUser, admin, adminCookie, config, originalDatabase, originalOrigins;
let created = false;

beforeAll(async () => {
  config = loadDatabaseConfig();
  if (
    config.host !== 'localhost' ||
    config.port !== 3306 ||
    config.database !== 'hhpaisanos' ||
    (config.user !== 'hhpaisanos' && !/^hhp_test_[a-f0-9]{16}$/.test(config.user))
  ) {
    throw new Error('Integration tests require the documented localhost Compose configuration');
  }
  if (!rootSql('SELECT VERSION();').startsWith('8.4.')) throw new Error('MySQL 8.4 required');
  dbUser = config.user;
  rootSql(
    `CREATE DATABASE \`${database}\`; GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${dbUser}'@'%';`,
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
    for (const code of ['ADMIN', 'ENLACE', 'OBSERVADOR', 'UNKNOWN']) {
      roleIds[code] = v7();
      await setup.db
        .insert(t.roles)
        .values({ id: roleIds[code], codigo: code, nombre: code, activo: true });
    }
  } finally {
    await setup.onModuleDestroy();
  }
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, 'localhost');
  baseUrl = await app.getUrl();
  db = app.get(DatabaseService).db;
  admin = await user('ADMIN');
}, 60000);

beforeEach(async () => {
  await app?.close();
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
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
        `DROP DATABASE \`${database}\`; REVOKE ALL PRIVILEGES ON \`${database}\`.* FROM '${dbUser}'@'%';`,
      );
  }
}, 30000);

async function user(role = 'ENLACE', temporary = false) {
  const id = v7(),
    username = `synthetic-${id}`;
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

function request(path, { method = 'GET', cookie = adminCookie, body, csrf = true } = {}) {
  return fetch(`${baseUrl}/api/${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== 'GET'
        ? {
            'Content-Type': 'application/json',
            Origin: origin,
            ...(csrf ? { 'X-HHP-CSRF': '1' } : {}),
          }
        : {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
}

async function login(account, suppliedPassword = password) {
  const response = await request('auth/login', {
    method: 'POST',
    cookie: null,
    body: { username: account.username, password: suppliedPassword },
  });
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function row(id) {
  return (await db.select().from(t.usuarios).where(eq(t.usuarios.id, id)))[0];
}
async function events(id) {
  return db.select().from(t.auditoria).where(eq(t.auditoria.entidadId, id));
}
async function sessions(id) {
  return db.select().from(t.sesiones).where(eq(t.sesiones.usuarioId, id));
}

it('provisions only the approved mappings explicitly, atomically and idempotently', async () => {
  const preview = await provisionUsersPermissions(db, admin.id, 'Synthetic approval');
  expect(approvedPermissions).toEqual([
    'users:create',
    'users:read',
    'users:update',
    'users:change-status',
    'users:assign-role',
    'users:reset-password',
    'roles:read',
    'permissions:read',
    ...operationalPermissions,
  ]);
  expect(preview).toHaveLength(46); // 18 permission rows, 18 ADMIN grants, 10 ENLACE grants.
  expect(await db.select().from(t.permisos)).toEqual([]);
  expect(await db.select().from(t.rolPermisos)).toEqual([]);
  expect(await db.select().from(t.auditoria)).toEqual([]);
  const observer = await user('OBSERVADOR');
  await expect(
    provisionUsersPermissions(db, observer.id, 'Synthetic approval', true),
  ).rejects.toThrow('active ADMIN');
  expect(await provisionUsersPermissions(db, admin.id, 'Synthetic approval', true)).toEqual(
    preview,
  );
  const actual = await db
    .select({ role: t.roles.codigo, code: t.permisos.codigo })
    .from(t.rolPermisos)
    .innerJoin(t.roles, eq(t.rolPermisos.rolId, t.roles.id))
    .innerJoin(t.permisos, eq(t.rolPermisos.permisoId, t.permisos.id));
  expect(
    actual
      .filter((grant) => grant.role === 'ADMIN')
      .map((grant) => grant.code)
      .sort(),
  ).toEqual([...approvedPermissions].sort());
  expect(
    actual
      .filter((grant) => grant.role === 'ENLACE')
      .map((grant) => grant.code)
      .sort(),
  ).toEqual([...operationalPermissions].sort());
  expect(actual.filter((grant) => grant.role === 'OBSERVADOR')).toEqual([]);
  const unrelated = v7();
  await db.insert(t.permisos).values({ id: unrelated, codigo: 'synthetic:unrelated' });
  await db.insert(t.rolPermisos).values({ rolId: roleIds.OBSERVADOR, permisoId: unrelated });
  const [read] = await db.select().from(t.permisos).where(eq(t.permisos.codigo, 'users:read'));
  await db.insert(t.rolPermisos).values({ rolId: roleIds.OBSERVADOR, permisoId: read.id });
  expect(await provisionUsersPermissions(db, admin.id, 'Reconcile approved mapping', true)).toEqual(
    [{ action: 'grant.remove', role: 'OBSERVADOR', permission: 'users:read' }],
  );
  expect(
    await db.select().from(t.rolPermisos).where(eq(t.rolPermisos.permisoId, unrelated)),
  ).toHaveLength(1);
  const before = await db.select().from(t.auditoria);
  expect(await provisionUsersPermissions(db, admin.id, 'Repeat', true)).toEqual([]);
  expect(await db.select().from(t.auditoria)).toEqual(before);
  expect(before.filter((e) => e.accion.startsWith('access.'))).toHaveLength(47);
  expect(
    before
      .filter((e) => e.accion.startsWith('access.'))
      .every((e) => e.usuarioId === admin.id && e.canal === 'manual' && e.motivo),
  ).toBe(true);
  adminCookie = (await login(admin)).cookie;
});

it('upgrades the previous ten-code mapping without changing existing grants or accounts', async () => {
  const addedCodes = operationalPermissions.filter((code) => !code.startsWith('operatives:'));
  const added = await db.select().from(t.permisos).where(inArray(t.permisos.codigo, addedCodes));
  const addedIds = added.map((permission) => permission.id);
  await db.delete(t.rolPermisos).where(inArray(t.rolPermisos.permisoId, addedIds));
  await db.delete(t.permisos).where(inArray(t.permisos.id, addedIds));
  const [create] = await db
    .select()
    .from(t.permisos)
    .where(eq(t.permisos.codigo, 'operatives:create'));
  await db
    .delete(t.rolPermisos)
    .where(and(eq(t.rolPermisos.rolId, roleIds.ENLACE), eq(t.rolPermisos.permisoId, create.id)));
  const existingPermissions = await db.select().from(t.permisos);
  const existingGrants = await db.select().from(t.rolPermisos);
  const accounts = await db.select().from(t.usuarios);
  const sessionsBefore = await db.select().from(t.sesiones);
  const observersBefore = await db.select().from(t.observadores);
  const auditBefore = await db.select().from(t.auditoria);
  const preview = await provisionUsersPermissions(db, admin.id, 'Upgrade preview');
  expect(preview).toHaveLength(25); // Eight new rows and grants for both roles, plus ENLACE creation.
  expect(preview.every((change) => change.action !== 'grant.remove')).toBe(true);
  expect(await db.select().from(t.permisos)).toEqual(existingPermissions);
  expect(await db.select().from(t.rolPermisos)).toEqual(existingGrants);
  expect(await db.select().from(t.auditoria)).toEqual(auditBefore);
  expect(await provisionUsersPermissions(db, admin.id, 'Approved upgrade', true)).toEqual(preview);
  expect(await db.select().from(t.permisos)).toEqual(expect.arrayContaining(existingPermissions));
  expect(await db.select().from(t.rolPermisos)).toEqual(expect.arrayContaining(existingGrants));
  expect(await db.select().from(t.usuarios)).toEqual(accounts);
  expect(await db.select().from(t.sesiones)).toEqual(sessionsBefore);
  expect(await db.select().from(t.observadores)).toEqual(observersBefore);
  const auditAfter = await db.select().from(t.auditoria);
  expect(auditAfter).toHaveLength(auditBefore.length + 25);
  expect(auditAfter.filter((event) => event.motivo === 'Approved upgrade')).toHaveLength(25);
  expect(await provisionUsersPermissions(db, admin.id, 'Repeat upgrade', true)).toEqual([]);
  expect(await db.select().from(t.auditoria)).toEqual(auditAfter);
});

it('requires ADMIN and each explicit permission, rejects temporary credentials and CSRF', async () => {
  const target = await user();
  const cases = [
    ['users', 'GET', undefined, 'users:read'],
    ['roles', 'GET', undefined, 'roles:read'],
    ['permissions', 'GET', undefined, 'permissions:read'],
    [
      `users/${target.id}`,
      'PATCH',
      { fullName: 'Blocked', reason: 'Unauthorized' },
      'users:update',
    ],
    [
      `users/${target.id}/status`,
      'PATCH',
      { active: false, reason: 'Unauthorized' },
      'users:change-status',
    ],
    [
      `users/${target.id}/role`,
      'PUT',
      { roleId: roleIds.OBSERVADOR, reason: 'Unauthorized' },
      'users:assign-role',
    ],
    [
      `users/${target.id}/reset-password`,
      'POST',
      { reason: 'Unauthorized' },
      'users:reset-password',
    ],
    [
      'users',
      'POST',
      { username: 'unauthorized', fullName: 'Synthetic', roleId: roleIds.ENLACE },
      'users:create',
    ],
  ];
  for (const [path, method, body, code] of cases) {
    expect((await request(path, { method, body, cookie: null })).status).toBe(401);
    const [permission] = await db.select().from(t.permisos).where(eq(t.permisos.codigo, code));
    await db
      .delete(t.rolPermisos)
      .where(
        and(eq(t.rolPermisos.rolId, roleIds.ADMIN), eq(t.rolPermisos.permisoId, permission.id)),
      );
    try {
      expect((await request(path, { method, body })).status).toBe(403);
    } finally {
      await db.insert(t.rolPermisos).values({ rolId: roleIds.ADMIN, permisoId: permission.id });
    }
  }
  const observer = await user('OBSERVADOR');
  const grants = await db
    .select()
    .from(t.permisos)
    .where(inArray(t.permisos.codigo, approvedPermissions));
  await db
    .insert(t.rolPermisos)
    .values(grants.map((p) => ({ rolId: roleIds.OBSERVADOR, permisoId: p.id })));
  const observed = await login(observer);
  try {
    for (const [path, method, body] of cases)
      expect((await request(path, { method, body, cookie: observed.cookie })).status).toBe(403);
  } finally {
    await provisionUsersPermissions(db, admin.id, 'Restore approved mappings', true);
  }
  const temporary = await login(await user('ADMIN', true));
  expect((await request('users', { cookie: temporary.cookie })).status).toBe(403);
  expect((await request('users', { method: 'POST', csrf: false })).status).toBe(403);
});

it('creates opaque temporary credentials, preserves Unicode and rejects protected inputs and duplicate usernames', async () => {
  const input = { username: `  ☀️${v7()}`, fullName: 'Synthetic 🌵', roleId: roleIds.OBSERVADOR };
  const response = await request('users', { method: 'POST', body: input });
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const createdUser = await response.json();
  expect(createdUser.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const stored = await row(createdUser.id);
  expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  expect(stored.nombreUsuario).toBe(input.username);
  expect(stored.debeCambiarPassword).toBe(true);
  expect(await sessions(createdUser.id)).toEqual([]);
  const signedIn = await login({ username: input.username }, createdUser.temporaryPassword);
  expect(signedIn.response.status).toBe(200);
  expect((await request('users', { cookie: signedIn.cookie })).status).toBe(403);
  const changed = await request('auth/change-password', {
    method: 'POST',
    cookie: signedIn.cookie,
    body: { currentPassword: createdUser.temporaryPassword, newPassword: password },
  });
  expect(changed.status).toBe(204);
  expect((await request('auth/me', { cookie: signedIn.cookie })).status).toBe(401);
  expect((await login({ username: input.username })).response.status).toBe(200);
  const raceInput = { ...input, username: `race-${v7()}` };
  const duplicates = await Promise.all(
    [1, 2].map(() => request('users', { method: 'POST', body: raceInput })),
  );
  expect(duplicates.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
  for (const extra of [
    { permissions: [] },
    { passwordHash: 'secret' },
    { mustChangePassword: false },
    { observerId: v7() },
  ]) {
    expect((await request('users', { method: 'POST', body: { ...input, ...extra } })).status).toBe(
      400,
    );
  }
  for (const roleId of [roleIds.ADMIN, roleIds.UNKNOWN]) {
    expect((await request('users', { method: 'POST', body: { ...input, roleId } })).status).toBe(
      403,
    );
  }
  const audit = await events(createdUser.id);
  expect(audit.filter((e) => e.accion === 'users.created')).toHaveLength(1);
  expect(JSON.stringify(audit)).not.toContain(createdUser.temporaryPassword);
  expect(JSON.stringify(audit)).not.toContain('$argon2');
});

it('paginates and filters safely, returns catalogs, and allows only fullName edits', async () => {
  const account = await user();
  const marker = `filter_%!${v7()}`;
  expect(
    (
      await request(`users/${account.id}`, {
        method: 'PATCH',
        body: { fullName: marker, reason: 'Correct name' },
      })
    ).status,
  ).toBe(204);
  const query = new URLSearchParams({
    search: marker,
    active: 'true',
    roleId: roleIds.ENLACE,
    pageSize: '1',
  });
  const response = await request(`users?${query}`);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const page = await response.json();
  expect(page.total).toBe(1);
  expect(page.items.map((u) => u.id)).toEqual([account.id]);
  expect((await (await request(`users?${query}&page=2`)).json()).items).toEqual([]);
  expect(
    (await (await request(`users?search=${encodeURIComponent(marker)}&active=false`)).json()).total,
  ).toBe(0);
  expect((await (await request('users?pageSize=1')).json()).items).toEqual(
    (await (await request('users?pageSize=1')).json()).items,
  );
  const detail = await (await request(`users/${account.id}`)).json();
  expect(detail.fullName).toBe(marker);
  expect(Object.keys(detail).sort()).toEqual(
    [
      'id',
      'username',
      'fullName',
      'roleId',
      'role',
      'active',
      'mustChangePassword',
      'lastLoginAt',
      'createdAt',
      'updatedAt',
    ].sort(),
  );
  expect((await request(`users/${admin.id}`)).status).toBe(200);
  for (const query of [
    'page=0',
    'pageSize=101',
    'active=0',
    'active[]=false',
    'page=1&page=2',
    'roleId=bad',
    'extra=1',
  ]) {
    expect((await request(`users?${query}`)).status).toBe(400);
  }
  expect((await request('users/not-a-uuid')).status).toBe(400);
  expect((await request(`users/${v7()}`)).status).toBe(404);
  expect(
    (
      await request(`users/${account.id}`, {
        method: 'PATCH',
        body: { fullName: 'Changed', username: 'renamed', reason: 'Attempt rename' },
      })
    ).status,
  ).toBe(400);
  expect((await row(account.id)).nombreUsuario).toBe(account.username);
  expect((await (await request('roles')).json()).map((r) => r.code)).toContain('ADMIN');
  expect((await (await request('permissions')).json()).map((p) => p.code)).toEqual(
    expect.arrayContaining(approvedPermissions),
  );
  const before = await events(account.id);
  expect(
    (
      await request(`users/${account.id}`, {
        method: 'PATCH',
        body: { fullName: marker, reason: 'Repeat' },
      })
    ).status,
  ).toBe(204);
  expect(await events(account.id)).toEqual(before);
  expect(JSON.stringify(before)).not.toContain(marker);
});

it('protects every ADMIN account including self under concurrent mutations and rejects inactive assignment roles', async () => {
  const otherAdmin = await user('ADMIN');
  const operations = (id) => [
    [`users/${id}`, 'PATCH', { fullName: 'Blocked', reason: 'Synthetic' }],
    [`users/${id}/status`, 'PATCH', { active: false, reason: 'Synthetic' }],
    [`users/${id}/role`, 'PUT', { roleId: roleIds.ENLACE, reason: 'Synthetic' }],
    [`users/${id}/reset-password`, 'POST', { reason: 'Synthetic' }],
  ];
  const before = [await row(admin.id), await row(otherAdmin.id)];
  const results = await Promise.all(
    [admin.id, otherAdmin.id]
      .flatMap(operations)
      .map(([path, method, body]) => request(path, { method, body })),
  );
  expect(results.map((r) => r.status)).toEqual(Array(8).fill(403));
  expect([await row(admin.id), await row(otherAdmin.id)]).toEqual(before);
  const account = await user();
  expect(
    (
      await request(`users/${account.id}/role`, {
        method: 'PUT',
        body: { roleId: roleIds.ADMIN, reason: 'Escalation' },
      })
    ).status,
  ).toBe(403);
  await db.update(t.roles).set({ activo: false }).where(eq(t.roles.id, roleIds.OBSERVADOR));
  try {
    expect(
      (
        await request(`users/${account.id}/role`, {
          method: 'PUT',
          body: { roleId: roleIds.OBSERVADOR, reason: 'Inactive' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request('users', {
          method: 'POST',
          body: { username: 'inactive-role', fullName: 'Synthetic', roleId: roleIds.OBSERVADOR },
        })
      ).status,
    ).toBe(403);
  } finally {
    await db.update(t.roles).set({ activo: true }).where(eq(t.roles.id, roleIds.OBSERVADOR));
  }
});

it('preserves observer links and profile state while deactivating accounts and revoking sessions', async () => {
  const account = await user('OBSERVADOR');
  const observerId = v7();
  await db.insert(t.observadores).values({
    id: observerId,
    nombres: 'Synthetic',
    apellidos: 'Observer',
    usuarioId: account.id,
    activo: true,
  });
  const first = await login(account),
    second = await login(account);
  expect(
    (
      await request(`users/${account.id}/role`, {
        method: 'PUT',
        body: { roleId: roleIds.ENLACE, reason: 'Linked' },
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(`users/${account.id}/role`, {
        method: 'PUT',
        body: { roleId: roleIds.OBSERVADOR, reason: 'No change' },
      })
    ).status,
  ).toBe(204);
  const [deactivated, racedLogin] = await Promise.all([
    request(`users/${account.id}/status`, {
      method: 'PATCH',
      body: { active: false, reason: 'Suspend access' },
    }),
    login(account),
  ]);
  expect(deactivated.status).toBe(204);
  expect([200, 401]).toContain(racedLogin.response.status);
  for (const cookie of [first.cookie, second.cookie, racedLogin.cookie].filter(Boolean))
    expect((await request('auth/me', { cookie })).status).toBe(401);
  expect((await sessions(account.id)).every((s) => s.revocadaEn !== null)).toBe(true);
  const [observer] = await db
    .select()
    .from(t.observadores)
    .where(eq(t.observadores.id, observerId));
  expect(observer.activo).toBe(true);
  expect(observer.usuarioId).toBe(account.id);
  const previousEvents = await events(account.id);
  expect(
    (
      await request(`users/${account.id}/status`, {
        method: 'PATCH',
        body: { active: false, reason: 'Repeat' },
      })
    ).status,
  ).toBe(204);
  expect(await events(account.id)).toEqual(previousEvents);
  expect(
    (
      await request(`users/${account.id}/status`, {
        method: 'PATCH',
        body: { active: true, reason: 'Restore' },
      })
    ).status,
  ).toBe(204);
  expect((await request('auth/me', { cookie: first.cookie })).status).toBe(401);
  expect((await login(account)).response.status).toBe(200);
});

it('resets credentials, clears login lockout, revokes sessions and requires password change without reactivating', async () => {
  const account = await user();
  const first = await login(account),
    second = await login(account);
  await db
    .update(t.usuarios)
    .set({ intentosFallidos: 5, bloqueadoHasta: sql`UTC_TIMESTAMP(6) + INTERVAL 15 MINUTE` })
    .where(eq(t.usuarios.id, account.id));
  const reset = await request(`users/${account.id}/reset-password`, {
    method: 'POST',
    body: { reason: 'Lost credentials' },
  });
  expect(reset.status).toBe(200);
  expect(reset.headers.get('cache-control')).toBe('no-store');
  const credentials = await reset.json();
  const stored = await row(account.id);
  expect(stored.intentosFallidos).toBe(0);
  expect(stored.bloqueadoHasta).toBeNull();
  expect(stored.debeCambiarPassword).toBe(true);
  expect(stored.passwordCambiadaEn).not.toBeNull();
  expect((await sessions(account.id)).every((s) => s.revocadaEn !== null)).toBe(true);
  for (const cookie of [first.cookie, second.cookie])
    expect((await request('auth/me', { cookie })).status).toBe(401);
  expect((await login(account)).response.status).toBe(401);
  const temporary = await login(account, credentials.temporaryPassword);
  expect(temporary.response.status).toBe(200);
  expect(
    (await (await request('auth/me', { cookie: temporary.cookie })).json()).mustChangePassword,
  ).toBe(true);
  const audit = await events(account.id);
  expect(audit.filter((e) => e.accion === 'users.password.reset')).toHaveLength(1);
  expect(JSON.stringify(audit)).not.toContain(credentials.temporaryPassword);
  await request(`users/${account.id}/status`, {
    method: 'PATCH',
    body: { active: false, reason: 'Suspend' },
  });
  const inactiveReset = await request(`users/${account.id}/reset-password`, {
    method: 'POST',
    body: { reason: 'Remain inactive' },
  });
  expect(inactiveReset.status).toBe(200);
  expect((await row(account.id)).activo).toBe(false);
  const racing = await user();
  const [racedReset, racedLogin] = await Promise.all([
    request(`users/${racing.id}/reset-password`, {
      method: 'POST',
      body: { reason: 'Concurrent reset' },
    }),
    login(racing),
  ]);
  expect(racedReset.status).toBe(200);
  expect([200, 401]).toContain(racedLogin.response.status);
  expect((await sessions(racing.id)).every((s) => s.revocadaEn !== null)).toBe(true);
});

it('revokes sessions on effective role changes and rechecks administrative authority inside transactions', async () => {
  const account = await user();
  const signedIn = await login(account);
  expect(
    (
      await request(`users/${account.id}/role`, {
        method: 'PUT',
        body: { roleId: roleIds.OBSERVADOR, reason: 'Reassign' },
      })
    ).status,
  ).toBe(204);
  expect((await request('auth/me', { cookie: signedIn.cookie })).status).toBe(401);
  expect((await row(account.id)).rolId).toBe(roleIds.OBSERVADOR);
  const event = (await events(account.id)).find((e) => e.accion === 'users.role.changed');
  expect(event.usuarioId).toBe(admin.id);
  expect(event.valoresAnteriores).toEqual({ roleId: roleIds.ENLACE });
  expect(event.valoresNuevos).toEqual({ roleId: roleIds.OBSERVADOR });
  const context = await app.get(AuthService).authenticate({ headers: { cookie: adminCookie } });
  const users = app.get(UsersService);
  const [permission] = await db
    .select()
    .from(t.permisos)
    .where(eq(t.permisos.codigo, 'users:update'));
  await db
    .delete(t.rolPermisos)
    .where(and(eq(t.rolPermisos.rolId, roleIds.ADMIN), eq(t.rolPermisos.permisoId, permission.id)));
  try {
    await expect(
      users.update(context, account.id, { fullName: 'Blocked', reason: 'Stale permission' }),
    ).rejects.toThrow('permissions');
  } finally {
    await db.insert(t.rolPermisos).values({ rolId: roleIds.ADMIN, permisoId: permission.id });
  }
  await request('auth/logout', { method: 'POST' });
  await expect(
    users.update(context, account.id, { fullName: 'Blocked', reason: 'Revoked session' }),
  ).rejects.toThrow('Authentication required');
  adminCookie = (await login(admin)).cookie;
});

it('rolls back account, session and provisioning mutations when audit fails without leaking driver values', async () => {
  const account = await user();
  const signedIn = await login(account);
  const before = await row(account.id),
    beforeSessions = await sessions(account.id);
  const [permission] = await db
    .select()
    .from(t.permisos)
    .where(eq(t.permisos.codigo, 'users:update'));
  await db
    .delete(t.rolPermisos)
    .where(and(eq(t.rolPermisos.rolId, roleIds.ADMIN), eq(t.rolPermisos.permisoId, permission.id)));
  rootSql(
    `CREATE TRIGGER \`${database}\`.synthetic_audit_failure BEFORE INSERT ON \`${database}\`.auditoria FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic-secret-error';`,
  );
  try {
    for (const [path, method, body] of [
      [`users/${account.id}/status`, 'PATCH', { active: false, reason: 'Synthetic' }],
      [`users/${account.id}/reset-password`, 'POST', { reason: 'Synthetic' }],
      [
        'users',
        'POST',
        { username: `rollback-${v7()}`, fullName: 'Synthetic', roleId: roleIds.ENLACE },
      ],
    ]) {
      const response = await request(path, { method, body });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('synthetic-secret-error');
    }
    await expect(
      provisionUsersPermissions(db, admin.id, 'Synthetic rollback', true),
    ).rejects.toThrow();
    expect(
      await db
        .select()
        .from(t.rolPermisos)
        .where(
          and(eq(t.rolPermisos.rolId, roleIds.ADMIN), eq(t.rolPermisos.permisoId, permission.id)),
        ),
    ).toEqual([]);
    expect(await row(account.id)).toEqual(before);
    expect(await sessions(account.id)).toEqual(beforeSessions);
    expect(await events(account.id)).toEqual([]);
  } finally {
    rootSql(`DROP TRIGGER \`${database}\`.synthetic_audit_failure;`);
    await provisionUsersPermissions(db, admin.id, 'Restore mapping', true);
  }
  expect((await request('auth/me', { cookie: signedIn.cookie })).status).toBe(200);
});
