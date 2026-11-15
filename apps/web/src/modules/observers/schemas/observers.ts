import { z } from 'zod';

// Preserve spelling and whitespace; the API counts Unicode code points.
const text = (label: string, max: number) =>
  z
    .string()
    .refine((value) => /\S/u.test(value), `Escribe ${label}.`)
    .refine((value) => Array.from(value).length <= max, `Máximo ${max} caracteres.`);
export const reasonSchema = text('el motivo administrativo', 500);
export const createObserverSchema = z.object({
  firstNames: text('los nombres', 100),
  lastNames: text('los apellidos', 100),
  phone: z.union([z.literal(''), text('un teléfono válido', 20)]),
});
export const editObserverSchema = createObserverSchema.extend({ reason: reasonSchema });
export const statusSchema = z.object({ reason: reasonSchema });
// Observers returns UTC MySQL DATETIME strings, preserving all six fractional digits.
const timestampSchema = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);
export const observerSchema = z.object({
  id: z.uuidv7(),
  firstNames: z.string(),
  lastNames: z.string(),
  phone: z.string().nullable(),
  active: z.boolean(),
  userId: z.uuidv7().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export const observerListSchema = z.object({
  items: z.array(observerSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});
export type Observer = z.infer<typeof observerSchema>;
export type CreateObserverInput = z.infer<typeof createObserverSchema>;
export type EditObserverInput = z.infer<typeof editObserverSchema>;
