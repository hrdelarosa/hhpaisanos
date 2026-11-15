import { z } from 'zod';

const civilDate = z.iso
  .date({ error: 'Escribe una fecha válida.' })
  .refine((value) => value >= '1000-01-01', 'La fecha debe estar entre los años 1000 y 9999.');
// class-validator MaxLength counts Unicode code points, not UTF-16 units.
const name = z
  .string()
  .trim()
  .min(1, 'Escribe el nombre.')
  .refine((value) => Array.from(value).length <= 120, 'El nombre admite hasta 120 caracteres.');
export const createOperativeSchema = z
  .object({ name, startDate: civilDate, endDate: civilDate })
  .refine((input) => input.startDate <= input.endDate, {
    path: ['endDate'],
    message: 'La fecha final no puede ser anterior a la inicial.',
  });
export const activationSchema = z.object({
  arrivalToleranceMinutes: z
    .number({ error: 'Escribe la tolerancia en minutos.' })
    .int('Usa minutos enteros.')
    .min(0, 'El mínimo es 0.')
    .max(65535, 'El máximo es 65535.'),
  reason: z
    .string()
    .refine((value) => /\S/u.test(value), 'Escribe el motivo administrativo.')
    .refine((value) => Array.from(value).length <= 500, 'El motivo admite hasta 500 caracteres.'),
});
export const operativeStatusSchema = z.enum(['borrador', 'activo', 'cerrado']);
export const operativeSchema = z.object({
  id: z.uuidv7(),
  name: z.string(),
  startDate: civilDate,
  endDate: civilDate,
  status: operativeStatusSchema,
  arrivalToleranceMinutes: z.number().int().min(0).max(65535).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const operativeListSchema = z.object({
  items: z.array(operativeSchema),
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});
export type Operative = z.infer<typeof operativeSchema>;
export type CreateOperativeInput = z.infer<typeof createOperativeSchema>;
export type ActivationInput = z.infer<typeof activationSchema>;
