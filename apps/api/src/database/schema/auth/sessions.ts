import { char, datetime, index, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { id, uuid } from '../uuid.js';
import { createdAt } from '../timestamps.js';
import { usuarios } from './access.js';

export const sesiones = mysqlTable(
  'sesiones',
  {
    id: id(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    ultimaActividadEn: datetime('ultima_actividad_en', { mode: 'string', fsp: 6 }).notNull(),
    expiraPorInactividadEn: datetime('expira_por_inactividad_en', { mode: 'string', fsp: 6 }),
    expiraEnAbsoluto: datetime('expira_en_absoluto', { mode: 'string', fsp: 6 }).notNull(),
    revocadaEn: datetime('revocada_en', { mode: 'string', fsp: 6 }),
    revocadaPor: uuid('revocada_por').references(() => usuarios.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    motivoRevocacion: varchar('motivo_revocacion', { length: 255 }),
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    creadoEn: createdAt(),
  },
  (t) => [index('sesiones_usuario_idx').on(t.usuarioId)],
);
