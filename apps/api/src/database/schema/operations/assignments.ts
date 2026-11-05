import { sql } from 'drizzle-orm';
import {
  check,
  date,
  datetime,
  index,
  mysqlTable,
  tinyint,
  time,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { usuarios } from '../auth/access.js';
import { observadores } from '../observers/observers.js';
import { id, uuid } from '../uuid.js';
import { timestamps } from '../timestamps.js';
import { modulosAtencion, operativos } from './operations.js';

export const asignaciones = mysqlTable(
  'asignaciones',
  {
    id: id(),
    operativoId: uuid('operativo_id')
      .notNull()
      .references(() => operativos.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    observadorId: uuid('observador_id')
      .notNull()
      .references(() => observadores.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    moduloId: uuid('modulo_id')
      .notNull()
      .references(() => modulosAtencion.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    horaInicio: time('hora_inicio').notNull(),
    horaFin: time('hora_fin').notNull(),
    canceladaEn: datetime('cancelada_en', { mode: 'string', fsp: 6 }),
    activa: tinyint('activa').generatedAlwaysAs(
      sql`CASE WHEN cancelada_en IS NULL THEN 1 ELSE NULL END`,
      { mode: 'stored' },
    ),
    creadoPor: uuid('creado_por')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('asignaciones_activa_unique').on(
      t.operativoId,
      t.observadorId,
      t.moduloId,
      t.fecha,
      t.horaInicio,
      t.horaFin,
      t.activa,
    ),
    index('asignaciones_observador_fecha_idx').on(t.observadorId, t.fecha),
    index('asignaciones_modulo_fecha_idx').on(t.moduloId, t.fecha),
    check(
      'asignaciones_horario_check',
      sql`${t.horaInicio} >= '00:00:00' AND ${t.horaFin} <= '23:59:59' AND ${t.horaFin} > ${t.horaInicio}`,
    ),
  ],
);
