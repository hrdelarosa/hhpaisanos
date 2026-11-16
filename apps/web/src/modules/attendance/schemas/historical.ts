import { z } from 'zod';
import { dateSchema } from '../../assignments/schemas/assignments';
import { reviewInputSchema } from './administration';
import { locationSchema } from './capture';

export const missingLocationLabels = {
  permission_denied: 'Permiso denegado',
  position_unavailable: 'Ubicación no disponible',
  timeout: 'Tiempo agotado',
  unsupported: 'No compatible',
  insecure_context: 'Contexto inseguro',
  unexpected_error: 'Error inesperado',
};

export const officialTimestampSchema = z.iso
  .datetime({ precision: 6, error: 'Usa YYYY-MM-DDTHH:mm:ss.ffffffZ en UTC.' })
  .refine((value) => {
    const date = new Date(value);
    return (
      Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 19) === value.slice(0, 19)
    );
  }, 'Escribe una hora UTC válida con seis decimales.');
export function attendanceCivilDate(timestamp: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}
export const correctionInputSchema = z.object({
  officialTimestamp: officialTimestampSchema,
  reason: reviewInputSchema.shape.reason,
});
export const manualInputSchema = correctionInputSchema
  .extend({
    observerId: z.uuidv7({ error: 'Selecciona un observador válido.' }),
    assignmentId: z.uuidv7({ error: 'Selecciona una asignación válida.' }),
    date: dateSchema,
    type: z.enum(['entrada', 'salida']),
    missingLocationReason: z.enum(locationSchema.options[1].shape.missingReason.options, {
      error: 'Selecciona el motivo real de falta de ubicación.',
    }),
  })
  .refine(
    (v) =>
      !officialTimestampSchema.safeParse(v.officialTimestamp).success ||
      attendanceCivilDate(v.officialTimestamp) === v.date,
    {
      path: ['officialTimestamp'],
      message: 'La hora debe pertenecer a la fecha civil en America/Mexico_City.',
    },
  );
export type ManualInput = z.infer<typeof manualInputSchema>;
export type CorrectionInput = z.infer<typeof correctionInputSchema>;
