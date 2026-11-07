import { afterEach, expect, it, vi } from 'vite-plus/test';
import { loadAuthConfig } from '../dist/modules/auth/auth.config.js';

afterEach(() => vi.unstubAllEnvs());

it('requires explicit HTTPS origins and secure host-only cookies outside local development', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('AUTH_ORIGINS', '');
  expect(() => loadAuthConfig()).toThrow();
  vi.stubEnv('AUTH_ORIGINS', 'http://localhost:5173');
  expect(() => loadAuthConfig()).toThrow();
  vi.stubEnv('AUTH_ORIGINS', 'https://paisanos.example');
  expect(loadAuthConfig()).toMatchObject({ secure: true, cookieName: '__Host-hhp_session' });
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('AUTH_ORIGINS', 'http://paisanos.example');
  expect(() => loadAuthConfig()).toThrow();
  vi.stubEnv('AUTH_ORIGINS', 'http://localhost:5173');
  expect(loadAuthConfig().secure).toBe(false);
});
