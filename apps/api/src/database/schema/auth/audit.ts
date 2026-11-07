import { index, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { id, uuid } from '../uuid.js';
import { createdAt } from '../timestamps.js';
import { usuarios } from './access.js';
import { sesiones } from './sessions.js';

export const auditoria = mysqlTable(
  'auditoria',
  {
    id: id(),
    usuarioId: uuid('usuario_id').references(() => usuarios.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    sesionId: uuid('sesion_id').references(() => sesiones.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    accion: varchar('accion', { length: 100 }).notNull(),
    tipoEntidad: varchar('tipo_entidad', { length: 100 }).notNull(),
    entidadId: uuid('entidad_id'),
    valoresAnteriores: json('valores_anteriores'),
    valoresNuevos: json('valores_nuevos'),
    motivo: varchar('motivo', { length: 500 }),
    canal: varchar('canal', { length: 20 }),
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    creadoEn: createdAt(),
  },
  (t) => [
    index('auditoria_entidad_idx').on(t.tipoEntidad, t.entidadId),
    index('auditoria_usuario_fecha_idx').on(t.usuarioId, t.creadoEn),
  ],
);
