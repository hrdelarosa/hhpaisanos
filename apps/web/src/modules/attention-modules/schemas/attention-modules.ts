import { z } from 'zod';

// Match class-validator's Unicode code-point limits, not UTF-16 length.
const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Escribe ${label}.`)
    .refine((value) => Array.from(value).length <= max, `Máximo ${max} caracteres.`);
export const createModuleSchema = z.object({
  name: text('el nombre', 120),
  municipality: text('el municipio', 100),
});
export const reasonSchema = z
  .string()
  .refine((value) => /\S/u.test(value), 'Escribe el motivo administrativo.')
  .refine((value) => Array.from(value).length <= 500, 'El motivo admite hasta 500 caracteres.');
export const editModuleSchema = createModuleSchema.extend({ reason: reasonSchema });
export const statusSchema = z.object({ reason: reasonSchema });
export const moduleSchema = z.object({
  id: z.uuidv7(),
  name: z.string(),
  municipality: z.string(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const moduleListSchema = z.object({
  items: z.array(moduleSchema),
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});
export type AttentionModule = z.infer<typeof moduleSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type EditModuleInput = z.infer<typeof editModuleSchema>;
