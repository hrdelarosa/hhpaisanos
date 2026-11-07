import { sql } from 'drizzle-orm';
import { datetime } from 'drizzle-orm/mysql-core';

// Strings preserve all six fractional digits; JavaScript Date only retains three.
export const createdAt = () =>
  datetime('creado_en', { mode: 'string', fsp: 6 })
    .notNull()
    .default(sql`(UTC_TIMESTAMP(6))`);

export const timestamps = () => ({
  creadoEn: createdAt(),
  actualizadoEn: datetime('actualizado_en', { mode: 'string', fsp: 6 })
    .notNull()
    .default(sql`(UTC_TIMESTAMP(6))`)
    .$onUpdateFn(() => sql`UTC_TIMESTAMP(6)`),
});
