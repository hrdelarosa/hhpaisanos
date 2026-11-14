import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  fullName: z.string().min(1),
  role: z.string().min(1),
  permissions: z.array(z.string()),
  mustChangePassword: z.boolean(),
});

const currentPassword = z
  .string()
  .min(1, 'Escribe tu contraseña.')
  .refine(
    (value) => new TextEncoder().encode(value).length <= 1024,
    'La contraseña excede el máximo de 1024 bytes.',
  );

export const loginSchema = z.object({
  username: z
    .string()
    .refine(
      (value) => /\S/u.test(value) && Array.from(value).length <= 50,
      'Escribe un usuario de 1 a 50 caracteres.',
    ),
  password: currentPassword,
});

export const passwordSchema = z
  .object({
    currentPassword,
    newPassword: z
      .string()
      .refine(
        (value) => Array.from(value).length >= 15 && Array.from(value).length <= 128,
        'Usa entre 15 y 128 caracteres.',
      ),
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword === value.currentPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'Usa una contraseña diferente de la actual.',
      });
    }
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Las contraseñas no coinciden.',
      });
    }
  });

export type AuthUser = z.infer<typeof userSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
