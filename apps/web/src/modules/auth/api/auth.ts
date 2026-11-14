import { z } from 'zod';
import { http } from '../../../lib/http';
import { userSchema, type LoginInput, type PasswordInput } from '../schemas/auth';

export const sessionKey = ['auth', 'me'] as const;

export async function getCurrentUser(signal: AbortSignal) {
  return userSchema.parse(await http('/api/auth/me', { signal }));
}

export async function login(input: LoginInput) {
  z.object({ authenticated: z.literal(true) }).parse(
    await http('/api/auth/login', { method: 'POST', body: input }),
  );
}

export async function logout() {
  await http('/api/auth/logout', { method: 'POST' });
}

export async function changePassword(input: PasswordInput) {
  await http('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword: input.currentPassword, newPassword: input.newPassword },
  });
}
