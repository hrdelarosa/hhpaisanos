import { sql } from 'drizzle-orm';
import {
  check,
  date,
  datetime,
  decimal,
  int,
  json,
  mysqlTable,
  tinyint,
  uniqueIndex,
  varchar,
  type AnyMySqlColumn,
  customType,
} from 'drizzle-orm/mysql-core';
import { usuarios } from '../auth/access.js';
import { sesiones } from '../auth/sessions.js';
import { createdAt } from '../timestamps.js';
import { id, uuid } from '../uuid.js';
import { asignaciones } from './assignments.js';

export type AttendanceResult =
  | { attendanceId: string; state: 'accepted_automatic' | 'pending_review' }
  | { code: 'ineligible' | 'day_changed' | 'initial_mark_exists' };

const exactKey = customType<{ data: string; driverData: string }>({
  dataType: () => 'varchar(128) COLLATE utf8mb4_0900_bin',
});

export const recibosAsistencia = mysqlTable(
  'recibos_asistencia',
  {
    id: id(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    sesionId: uuid('sesion_id')
      .notNull()
      .references(() => sesiones.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    operacion: varchar('operacion', { length: 40 }).notNull(),
    clave: exactKey('clave').notNull(),
    recibidoEn: datetime('recibido_en', { mode: 'string', fsp: 6 }).notNull(),
    fechaLocal: date('fecha_local', { mode: 'string' }).notNull(),
    contenido: json('contenido').$type<Record<string, unknown>>().notNull(),
    estado: varchar('estado', { length: 12 })
      .$type<'pending' | 'completed' | 'rejected'>()
      .notNull()
      .default('pending'),
    resultado: json('resultado').$type<AttendanceResult>(),
    creadoEn: createdAt(),
  },
  (t) => [
    uniqueIndex('recibos_scope_unique').on(t.usuarioId, t.operacion, t.clave),
    check(
      'recibos_resultado_check',
      sql`(${t.estado} = 'pending' AND ${t.resultado} IS NULL) OR (${t.estado} IN ('completed', 'rejected') AND ${t.resultado} IS NOT NULL AND JSON_TYPE(${t.resultado}) = 'OBJECT')`,
    ),
  ],
);

export const registrosAsistencia = mysqlTable(
  'registros_asistencia',
  {
    id: id(),
    asignacionId: uuid('asignacion_id')
      .notNull()
      .references(() => asignaciones.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    fechaAsistencia: date('fecha_asistencia', { mode: 'string' }).notNull(),
    tipo: varchar('tipo', { length: 10 }).$type<'entrada' | 'salida'>().notNull(),
    version: int('version', { unsigned: true }).notNull().default(1),
    vigente: tinyint('vigente').default(1),
    registradoEn: datetime('registrado_en', { mode: 'string', fsp: 6 }).notNull(),
    registradoPor: uuid('registrado_por')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    canal: varchar('canal', { length: 20 }).notNull(),
    reciboId: uuid('recibo_id').references(() => recibosAsistencia.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    anteriorId: uuid('anterior_id').references((): AnyMySqlColumn => registrosAsistencia.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    latitud: decimal('latitud', { precision: 9, scale: 6 }),
    longitud: decimal('longitud', { precision: 9, scale: 6 }),
    precisionM: decimal('precision_m', { precision: 13, scale: 6 }),
    motivoSinUbicacion: varchar('motivo_sin_ubicacion', { length: 30 }),
    estado: varchar('estado', { length: 24 }).notNull(),
    llegadaTardia: tinyint('llegada_tardia').notNull().default(0),
    salidaTemprana: tinyint('salida_temprana').notNull().default(0),
    politicaVersion: varchar('politica_version', { length: 40 }).notNull(),
    motivoCapturaManual: varchar('motivo_captura_manual', { length: 500 }),
    motivoCorreccion: varchar('motivo_correccion', { length: 500 }),
    revisadoPor: uuid('revisado_por').references(() => usuarios.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    revisadoEn: datetime('revisado_en', { mode: 'string', fsp: 6 }),
    motivoDecision: varchar('motivo_decision', { length: 500 }),
    creadoEn: createdAt(),
  },
  (t) => [
    uniqueIndex('asistencia_version_unique').on(
      t.asignacionId,
      t.fechaAsistencia,
      t.tipo,
      t.version,
    ),
    uniqueIndex('asistencia_vigente_unique').on(
      t.asignacionId,
      t.fechaAsistencia,
      t.tipo,
      t.vigente,
    ),
    uniqueIndex('asistencia_recibo_unique').on(t.reciboId),
    uniqueIndex('asistencia_anterior_unique').on(t.anteriorId),
    check('asistencia_tipo_check', sql`${t.tipo} IN ('entrada', 'salida')`),
    check(
      'asistencia_version_check',
      sql`${t.version} > 0 AND (${t.vigente} IS NULL OR ${t.vigente} = 1) AND (${t.version} = 1 OR ${t.estado} <> 'accepted_automatic')`,
    ),
    check(
      'asistencia_procedencia_check',
      sql`(${t.version} = 1 AND ${t.anteriorId} IS NULL AND ${t.motivoCorreccion} IS NULL) OR (${t.version} > 1 AND ${t.anteriorId} IS NOT NULL AND ${t.motivoCorreccion} IS NOT NULL AND CHAR_LENGTH(TRIM(${t.motivoCorreccion})) > 0 AND ${t.reciboId} IS NULL)`,
    ),
    check(
      'asistencia_canal_check',
      sql`${t.canal} IN ('web', 'manual') AND (${t.canal} <> 'manual' OR (${t.motivoCapturaManual} IS NOT NULL AND CHAR_LENGTH(TRIM(${t.motivoCapturaManual})) > 0 AND ${t.reciboId} IS NULL)) AND (${t.version} <> 1 OR ${t.canal} <> 'web' OR ${t.reciboId} IS NOT NULL)`,
    ),
    check(
      'asistencia_ubicacion_check',
      sql`(${t.latitud} IS NOT NULL AND ${t.longitud} IS NOT NULL AND ${t.precisionM} IS NOT NULL AND ${t.latitud} BETWEEN -90 AND 90 AND ${t.longitud} BETWEEN -180 AND 180 AND ${t.precisionM} >= 0 AND ${t.motivoSinUbicacion} IS NULL) OR (${t.latitud} IS NULL AND ${t.longitud} IS NULL AND ${t.precisionM} IS NULL AND ${t.motivoSinUbicacion} IS NOT NULL AND ${t.motivoSinUbicacion} IN ('permission_denied', 'position_unavailable', 'timeout', 'unsupported', 'insecure_context', 'unexpected_error'))`,
    ),
    check(
      'asistencia_estado_check',
      sql`${t.estado} IN ('accepted_automatic', 'pending_review', 'accepted_administrative', 'rejected', 'annulled')`,
    ),
    check(
      'asistencia_alertas_check',
      sql`${t.llegadaTardia} IN (0, 1) AND ${t.salidaTemprana} IN (0, 1) AND (${t.estado} <> 'accepted_automatic' OR (${t.llegadaTardia} = 0 AND ${t.salidaTemprana} = 0 AND ${t.motivoSinUbicacion} IS NULL))`,
    ),
    check(
      'asistencia_decision_check',
      sql`(${t.revisadoPor} IS NULL AND ${t.revisadoEn} IS NULL AND ${t.motivoDecision} IS NULL AND ${t.estado} IN ('accepted_automatic', 'pending_review')) OR (${t.revisadoPor} IS NOT NULL AND ${t.revisadoEn} IS NOT NULL AND ${t.motivoDecision} IS NOT NULL AND CHAR_LENGTH(TRIM(${t.motivoDecision})) > 0 AND ${t.estado} IN ('accepted_administrative', 'rejected', 'annulled'))`,
    ),
  ],
);
