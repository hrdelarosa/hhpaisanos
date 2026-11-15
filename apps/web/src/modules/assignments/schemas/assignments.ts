import { z } from 'zod';

export const dateSchema = z.iso
  .date({ error: 'Escribe una fecha válida.' })
  .refine((value) => value >= '1000-01-01', 'Usa un año entre 1000 y 9999.');
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, 'Usa HH:mm:ss.');
const id = z.uuidv7({ error: 'Selecciona un registro válido.' });
export const assignmentSchema = z.object({
  id,
  operativeId: id,
  observerId: id,
  attentionModuleId: id,
  validFrom: dateSchema,
  validTo: dateSchema,
  startTime: time,
  endTime: time,
  cancelledAt: z.iso.datetime().nullable(),
  version: z.number().int().min(1).max(4294967295),
  createdBy: id,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const assignmentListSchema = z.object({
  items: z.array(assignmentSchema),
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});
export const createAssignmentSchema = z
  .object({
    operativeId: id,
    observerId: id,
    attentionModuleId: id,
    validFrom: dateSchema,
    validTo: dateSchema,
    startTime: time,
    endTime: time,
  })
  .refine((v) => v.validFrom <= v.validTo, {
    path: ['validTo'],
    message: 'El fin no puede ser anterior al inicio.',
  })
  .refine((v) => v.startTime < v.endTime, {
    path: ['endTime'],
    message: 'La salida debe ser posterior a la entrada, en el mismo día.',
  });
const reason = z
  .string()
  .refine((v) => /\S/u.test(v), 'Escribe el motivo administrativo.')
  .refine((v) => Array.from(v).length <= 500, 'Máximo 500 caracteres.');
export const actionSchema = z.object({
  reason,
  effectiveFrom: z.union([z.literal(''), dateSchema]),
  lastValidDate: z.union([z.literal(''), dateSchema]),
  attentionModuleId: z.union([z.literal(''), id]),
  startTime: z.union([z.literal(''), time]),
  endTime: z.union([z.literal(''), time]),
});
export type Assignment = z.infer<typeof assignmentSchema>;
export type CreateAssignment = z.infer<typeof createAssignmentSchema>;
export type AssignmentAction = z.infer<typeof actionSchema>;
export type Operation = 'change' | 'terminate' | 'cancel';
export const filterSchema = z
  .object({
    operativeId: z.union([z.literal(''), id]),
    observerId: z.union([z.literal(''), id]),
    attentionModuleId: z.union([z.literal(''), id]),
    applicableOn: z.union([z.literal(''), dateSchema]),
    from: z.union([z.literal(''), dateSchema]),
    to: z.union([z.literal(''), dateSchema]),
    cancelled: z.enum(['', 'true', 'false']),
    page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    limit: z.number().int().min(1).max(100),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to)
  .refine((v) => Number.isSafeInteger((v.page - 1) * v.limit));
export type AssignmentFilters = z.infer<typeof filterSchema>;
