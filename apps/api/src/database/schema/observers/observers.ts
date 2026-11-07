import { sql } from 'drizzle-orm';
import { boolean, check, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { usuarios } from '../auth/access.js';
import { id, uuid } from '../uuid.js';
import { timestamps } from '../timestamps.js';

export const observadores = mysqlTable(
  'observadores',
  {
    id: id(),
    nombres: varchar('nombres', { length: 100 }).notNull(),
    apellidos: varchar('apellidos', { length: 100 }).notNull(),
    telefono: varchar('telefono', { length: 20 }),
    usuarioId: uuid('usuario_id')
      .unique()
      .references(() => usuarios.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    activo: boolean('activo').notNull(),
    ...timestamps(),
  },
  (t) => [check('observadores_activo_check', sql`${t.activo} IN (0, 1)`)],
);
