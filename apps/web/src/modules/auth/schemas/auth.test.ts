import { expect, it } from 'vite-plus/test';
import { loginSchema, passwordSchema, userSchema } from './auth';

it('uses backend code-point and UTF-8 limits without trimming credentials', () => {
  expect(
    loginSchema.safeParse({ username: '🙂'.repeat(50), password: '🙂'.repeat(256) }).success,
  ).toBe(true);
  expect(loginSchema.safeParse({ username: 'x', password: '🙂'.repeat(257) }).success).toBe(false);
  expect(loginSchema.parse({ username: ' x ', password: ' secret ' })).toEqual({
    username: ' x ',
    password: ' secret ',
  });
  expect(
    passwordSchema.safeParse({
      currentPassword: 'old',
      newPassword: '🙂'.repeat(15),
      confirmPassword: '🙂'.repeat(15),
    }).success,
  ).toBe(true);
  expect(
    passwordSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'x'.repeat(129),
      confirmPassword: 'x'.repeat(129),
    }).success,
  ).toBe(false);
});

it('keeps only the public user projection at the response boundary', () => {
  const result = userSchema.parse({
    id: 'synthetic',
    username: 'sample',
    fullName: 'Persona sintética',
    role: 'ENLACE',
    permissions: [],
    mustChangePassword: false,
    sessionId: 'must-not-retain',
    token: 'must-not-retain',
  });
  expect(result).not.toHaveProperty('sessionId');
  expect(result).not.toHaveProperty('token');
});
