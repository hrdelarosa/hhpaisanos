import 'reflect-metadata';
import { pathToFileURL } from 'node:url';
import { and, eq, inArray } from 'drizzle-orm';
import { validate, version } from 'uuid';
import { DatabaseService } from '../dist/database/database.service.js';
import { loadDatabaseConfig } from '../dist/database/database.config.js';
import {
  auditoria,
  permisos,
  roles,
  rolPermisos,
  usuarios,
} from '../dist/database/schema/index.js';

const ownAttendancePermissions = ['attendance:read-own', 'attendance:capture-own'];

// Deliberately closed catalog: this command cannot provision arbitrary privileges.
export const approvedPermissions = [
  'users:create',
  'users:read',
  'users:update',
  'users:change-status',
  'users:assign-role',
  'users:reset-password',
  'roles:read',
  'permissions:read',
  'operatives:read',
  'operatives:create',
  'operatives:activate',
  'observers:read',
  'observers:create',
  'observers:update',
  'observers:change-status',
  'observers:link-account',
  'attention-modules:read',
  'attention-modules:create',
  'attention-modules:update',
  'attention-modules:change-status',
  'assignments:read',
  'assignments:create',
  'assignments:update',
  'assignments:cancel',
  ...ownAttendancePermissions,
];
const mappings = {
  ADMIN: approvedPermissions.filter((code) => !ownAttendancePermissions.includes(code)),
  ENLACE: [
    'operatives:read',
    'operatives:create',
    'operatives:activate',
    'observers:read',
    'observers:create',
    'observers:update',
    'observers:change-status',
    'observers:link-account',
    'attention-modules:read',
    'attention-modules:create',
    'attention-modules:update',
    'attention-modules:change-status',
    'assignments:read',
    'assignments:create',
    'assignments:update',
    'assignments:cancel',
  ],
  OBSERVADOR: ownAttendancePermissions,
};

export async function provisionUsersPermissions(db, actorId, reason, apply = false) {
  if (
    !validate(actorId) ||
    version(actorId) !== 7 ||
    typeof reason !== 'string' ||
    !/\S/u.test(reason) ||
    Array.from(reason).length > 500 ||
    typeof apply !== 'boolean'
  ) {
    throw new Error('Expected an ADMIN UUIDv7 and a nonblank reason of at most 500 code points');
  }
  return db.transaction(async (tx) => {
    const [actor] = await tx.select().from(usuarios).where(eq(usuarios.id, actorId)).for('update');
    // Lock catalog rows in a fixed order to serialize repeated/concurrent provisioning.
    const catalog = await tx
      .select()
      .from(roles)
      .where(inArray(roles.codigo, Object.keys(mappings)))
      .orderBy(roles.codigo)
      .for('update');
    if (
      !actor?.activo ||
      !catalog.some((role) => role.id === actor.rolId && role.codigo === 'ADMIN' && role.activo)
    ) {
      throw new Error('An existing active ADMIN account and role are required');
    }
    if (catalog.length !== 3)
      throw new Error('ADMIN, ENLACE and OBSERVADOR roles must already exist');
    const changes = [];
    const audit = async (action, entityType, entityId, values) => {
      await tx.insert(auditoria).values({
        usuarioId: actorId,
        accion: action,
        tipoEntidad: entityType,
        entidadId: entityId,
        valoresNuevos: values,
        motivo: reason,
        canal: 'manual',
      });
    };
    for (const code of approvedPermissions) {
      let [permission] = await tx
        .select()
        .from(permisos)
        .where(eq(permisos.codigo, code))
        .for('update');
      if (!permission) {
        changes.push({ action: 'permission.create', permission: code });
        if (apply) {
          const [{ id }] = await tx.insert(permisos).values({ codigo: code }).$returningId();
          permission = { id };
          await audit('access.permission.created', 'permisos', id, { code });
        }
      }
      for (const role of catalog) {
        const [grant] = permission
          ? await tx
              .select()
              .from(rolPermisos)
              .where(and(eq(rolPermisos.rolId, role.id), eq(rolPermisos.permisoId, permission.id)))
              .for('update')
          : [];
        const expected = mappings[role.codigo].includes(code);
        if (Boolean(grant) === expected) continue;
        changes.push({
          action: expected ? 'grant.add' : 'grant.remove',
          role: role.codigo,
          permission: code,
        });
        if (!apply) continue;
        if (expected)
          await tx.insert(rolPermisos).values({ rolId: role.id, permisoId: permission.id });
        else
          await tx
            .delete(rolPermisos)
            .where(and(eq(rolPermisos.rolId, role.id), eq(rolPermisos.permisoId, permission.id)));
        await audit(
          expected ? 'access.permission.granted' : 'access.permission.revoked',
          'roles',
          role.id,
          { permissionId: permission.id, granted: expected },
        );
      }
    }
    return changes;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let database;
  try {
    const [actorId, reason, mode, ...extra] = process.argv.slice(2);
    if (extra.length || (mode !== undefined && mode !== '--apply')) {
      throw new Error('Usage: users:provision-permissions <ADMIN UUIDv7> <reason> [--apply]');
    }
    database = new DatabaseService(loadDatabaseConfig());
    await database.onModuleInit();
    const changes = await provisionUsersPermissions(
      database.db,
      actorId,
      reason,
      mode === '--apply',
    );
    console.log(JSON.stringify({ applied: mode === '--apply', changes }, null, 2));
  } catch {
    console.error(
      'Permission provisioning failed. Check arguments, existing roles, active ADMIN and database configuration. No changes committed.',
    );
    process.exitCode = 1;
  } finally {
    try {
      await database?.onModuleDestroy();
    } catch {
      console.error('Database connection cleanup failed.');
      process.exitCode = 1;
    }
  }
}
