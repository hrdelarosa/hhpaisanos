import { z } from 'zod';

export const civilDateSchema = z.iso
  .date()
  .min(10)
  .refine((date) => date >= '1000-01-01');
const markSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  officialTimestamp: z.iso.datetime(),
  reviewStatus: z.enum([
    'accepted_automatic',
    'pending_review',
    'accepted_administrative',
    'rejected',
    'annulled',
  ]),
  anomalies: z.array(z.enum(['late_arrival', 'early_departure', 'missing_location'])),
});

// Keep only the read-view projection in Query; never retain GPS or receipt payloads.
export const attendanceDaySchema = z.object({
  assignmentId: z.string().min(1),
  operativeName: z.string(),
  moduleName: z.string(),
  date: civilDateSchema,
  startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  completeness: z.enum(['none', 'check_in_only', 'check_out_only', 'complete']),
  checkIn: markSchema.nullable(),
  checkOut: markSchema.nullable(),
});

export const todaySchema = z.object({
  date: civilDateSchema,
  timeZone: z.literal('America/Mexico_City'),
  assignments: z.array(attendanceDaySchema),
});

export const historySchema = z.object({
  items: z.array(attendanceDaySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1).max(1_000_000),
  limit: z.number().int().min(1).max(100),
});

export type AttendanceDay = z.infer<typeof attendanceDaySchema>;
export type AttendanceMark = z.infer<typeof markSchema>;
