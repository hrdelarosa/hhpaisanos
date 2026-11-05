import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  decimal,
  mysqlTable,
  smallint,
  varchar,
} from 'drizzle-orm/mysql-core';
import { id } from '../uuid.js';
import { timestamps } from '../timestamps.js';

export const operativos = mysqlTable(
  'operativos',
  {
    id: id(),
    nombre: varchar('nombre', { length: 120 }).notNull(),
    fechaInicio: date('fecha_inicio', { mode: 'string' }).notNull(),
    fechaFin: date('fecha_fin', { mode: 'string' }).notNull(),
    estado: varchar('estado', { length: 20 }).notNull(),
    toleranciaMinutos: smallint('tolerancia_minutos', { unsigned: true }),
    precisionMaximaM: smallint('precision_maxima_m', { unsigned: true }),
    ...timestamps(),
  },
  (t) => [
    check('operativos_fechas_check', sql`${t.fechaInicio} <= ${t.fechaFin}`),
    check('operativos_estado_check', sql`${t.estado} IN ('borrador', 'activo', 'cerrado')`),
  ],
);

export const modulosAtencion = mysqlTable(
  'modulos_atencion',
  {
    id: id(),
    nombre: varchar('nombre', { length: 120 }).notNull(),
    municipio: varchar('municipio', { length: 100 }).notNull(),
    latitud: decimal('latitud', { precision: 9, scale: 6 }),
    longitud: decimal('longitud', { precision: 9, scale: 6 }),
    radioValidacionM: smallint('radio_validacion_m', { unsigned: true }),
    activo: boolean('activo').notNull(),
    ...timestamps(),
  },
  (t) => [
    check(
      'modulos_coordenadas_pares_check',
      sql`(${t.latitud} IS NULL AND ${t.longitud} IS NULL) OR (${t.latitud} IS NOT NULL AND ${t.longitud} IS NOT NULL)`,
    ),
    check('modulos_latitud_check', sql`${t.latitud} BETWEEN -90 AND 90`),
    check('modulos_longitud_check', sql`${t.longitud} BETWEEN -180 AND 180`),
    check('modulos_activo_check', sql`${t.activo} IN (0, 1)`),
  ],
);

export const conceptosAtencion = mysqlTable(
  'conceptos_atencion',
  {
    id: id(),
    clave: varchar('clave', { length: 40 }).notNull().unique(),
    nombre: varchar('nombre', { length: 150 }).notNull(),
    orden: smallint('orden').notNull(),
    requiereEspecificacion: boolean('requiere_especificacion').notNull(),
    activo: boolean('activo').notNull(),
    ...timestamps(),
  },
  (t) => [
    check('conceptos_especificacion_check', sql`${t.requiereEspecificacion} IN (0, 1)`),
    check('conceptos_activo_check', sql`${t.activo} IN (0, 1)`),
  ],
);
