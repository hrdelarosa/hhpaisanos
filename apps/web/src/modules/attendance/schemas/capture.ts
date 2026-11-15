import { z } from 'zod';
import { civilDateSchema } from './attendance';

export const locationSchema = z.union([
  z.strictObject({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(9999999.999999),
  }),
  z.strictObject({
    missingReason: z.enum([
      'permission_denied',
      'position_unavailable',
      'timeout',
      'unsupported',
      'insecure_context',
      'unexpected_error',
    ]),
  }),
]);

export const captureInputSchema = z.strictObject({
  assignmentId: z.uuidv7(),
  expectedDate: civilDateSchema,
  location: locationSchema,
});
export const captureResultSchema = z.object({
  attendanceId: z.uuidv7(),
  state: z.enum(['accepted_automatic', 'pending_review']),
});
export type CaptureLocation = z.infer<typeof locationSchema>;
export type CaptureInput = z.infer<typeof captureInputSchema>;
export type CaptureResult = z.infer<typeof captureResultSchema>;
export type CaptureOperation = 'check-in' | 'check-out';
