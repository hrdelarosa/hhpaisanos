import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  datetime,
  index,
  mysqlTable,
  primaryKey,
  smallint,
  varchar,
} from 'drizzle-orm/mysql-core';
import { id, uuid } from '../uuid.js';
import { createdAt, timestamps } from '../timestamps.js';

export const roles = mysqlTable(
  'roles',
  {
    id: id(),
    codigo: varchar('codigo', { length: 50 }).notNull().unique(),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    descripcion: varchar('descripcion', { length: 355 }),
    activo: boolean('activo').notNull(),
    ...timestamps(),
  },
  (t) => [check('roles_activo_check', sql`${t.activo} IN (0, 1)`)],
);

export const permisos = mysqlTable('permisos', {
  id: id(),
  codigo: varchar('codigo', { length: 100 }).notNull().unique(),
  descripcion: varchar('descripcion', { length: 500 }),
  creadoEn: createdAt(),
});

export const rolPermisos = mysqlTable(
  'rol_permisos',
  {
    rolId: uuid('rol_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    permisoId: uuid('permiso_id')
      .notNull()
      .references(() => permisos.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    creadoEn: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.rolId, t.permisoId] })],
);

export const usuarios = mysqlTable(
  'usuarios',
  {
    id: id(),
    rolId: uuid('rol_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    nombreUsuario: varchar('nombre_usuario', { length: 50 }).notNull().unique(),
    nombreCompleto: varchar('nombre_completo', { length: 150 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    activo: boolean('activo').notNull(),
    debeCambiarPassword: boolean('debe_cambiar_password').notNull(),
    passwordCambiadaEn: datetime('password_cambiada_en', { mode: 'string', fsp: 6 }),
    intentosFallidos: smallint('intentos_fallidos', { unsigned: true }).notNull(),
    bloqueadoHasta: datetime('bloqueado_hasta', { mode: 'string', fsp: 6 }),
    ultimoAccesoEn: datetime('ultimo_acceso_en', { mode: 'string', fsp: 6 }),
    ...timestamps(),
  },
  (t) => [
    index('usuarios_rol_activo_idx').on(t.rolId, t.activo),
    check('usuarios_activo_check', sql`${t.activo} IN (0, 1)`),
    check('usuarios_cambiar_password_check', sql`${t.debeCambiarPassword} IN (0, 1)`),
  ],
);
