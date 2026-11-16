import { z } from 'zod';
import { civilDateSchema, markSchema } from './attendance';

const optionalId = z.union([z.literal(''), z.uuidv7()]);
const optionalDate = z.union([z.literal(''), civilDateSchema]);
export const reviewStatuses = markSchema.shape.reviewStatus;
export const anomalies = markSchema.shape.anomalies.element;
export const administrativeFiltersSchema = z
  .object({
    operativeId: optionalId,
    observerId: optionalId,
    moduleId: optionalId,
    from: optionalDate,
    to: optionalDate,
    reviewStatus: z.union([z.literal(''), reviewStatuses]),
    anomaly: z.union([z.literal(''), anomalies]),
    page: z.number().int().min(1).max(1_000_000),
    limit: z.number().int().min(1).max(100),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to);

const missingLocation = z.object({ status: z.literal('missing'), reason: z.string() });
export const administrativeMarkSchema = markSchema.extend({
  assignmentId: z.uuidv7(),
  date: civilDateSchema,
  type: z.enum(['entrada', 'salida']),
  current: z.boolean(),
  policyVersion: z.string(),
  channel: z.enum(['web', 'manual']),
  observerId: z.uuidv7(),
  observerName: z.string(),
  operativeId: z.uuidv7(),
  operativeName: z.string(),
  moduleId: z.uuidv7(),
  moduleName: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  completeness: z.enum(['none', 'check_in_only', 'check_out_only', 'complete']),
  locationEvidence: z.union([
    missingLocation,
    z.object({ status: z.literal('provided_unverified') }),
  ]),
});
export const administrativeDetailSchema = administrativeMarkSchema.extend({
  originalEventTimestamp: z.iso.datetime(),
  predecessorId: z.uuidv7().nullable(),
  captureActorId: z.uuidv7(),
  manualReason: z.string().nullable(),
  correctionReason: z.string().nullable(),
  decision: z.object({
    actorId: z.uuidv7().nullable(),
    timestamp: z.iso.datetime().nullable(),
    reason: z.string().nullable(),
  }),
  locationEvidence: z.union([
    missingLocation,
    z.object({
      status: z.literal('provided_unverified'),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().nonnegative(),
    }),
  ]),
});
const page = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
});
export const administrativeListSchema = page.extend({ items: z.array(administrativeMarkSchema) });
export const administrativeHistorySchema = page.extend({
  items: z.array(
    administrativeMarkSchema.extend({
      events: z.array(
        z.object({
          action: z.string(),
          actorId: z.uuidv7().nullable(),
          reason: z.string().nullable(),
          timestamp: z.iso.datetime(),
          previousStatus: z.string().nullable(),
          reviewStatus: z.string().nullable(),
        }),
      ),
    }),
  ),
});
export const reviewInputSchema = z.object({
  decision: z.enum(['accept', 'reject']),
  reason: z
    .string()
    .refine(
      (v) => /\S/u.test(v) && Array.from(v).length <= 500,
      'Escribe un motivo no vacío de hasta 500 caracteres.',
    ),
});
export type AdministrativeFilters = z.infer<typeof administrativeFiltersSchema>;
export type AdministrativeMark = z.infer<typeof administrativeMarkSchema>;
export type AdministrativeDetail = z.infer<typeof administrativeDetailSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;
