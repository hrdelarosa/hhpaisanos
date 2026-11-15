import { z } from 'zod';

const text = (max: number) =>
  z
    .string()
    .refine(
      (v) => /\S/u.test(v) && Array.from(v).length <= max,
      `Escribe entre 1 y ${max} caracteres, no solo espacios.`,
    );
export const reasonSchema = text(500);
export const createUserSchema = z.object({
  username: text(50),
  fullName: text(150),
  roleId: z.uuidv7('Selecciona un rol disponible.'),
});
export const editUserSchema = z.object({ fullName: text(150), reason: reasonSchema });
export const statusSchema = z.object({ reason: reasonSchema });
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);
export const userSchema = z.object({
  id: z.uuidv7(),
  username: z.string(),
  fullName: z.string(),
  roleId: z.uuidv7(),
  role: z.string(),
  active: z.boolean(),
  mustChangePassword: z.boolean(),
  lastLoginAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const userListSchema = z.object({
  items: z.array(userSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});
export const rolesSchema = z.array(
  z.object({
    id: z.uuidv7(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    active: z.boolean(),
  }),
);
export const createdUserSchema = z.object({ id: z.uuidv7(), temporaryPassword: z.string().min(1) });
export type UserAccount = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
