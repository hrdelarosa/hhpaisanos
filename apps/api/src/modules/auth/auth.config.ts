export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export type AuthConfig = { secure: boolean; cookieName: string; origins: string[] };

export function loadAuthConfig(): AuthConfig {
  const production = !['development', 'test'].includes(process.env.NODE_ENV ?? 'development');
  const origins = (process.env.AUTH_ORIGINS ?? (production ? '' : 'http://localhost:5173'))
    .split(',')
    .map((origin) => origin.trim());
  if (
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          url.origin !== origin ||
          (url.protocol !== 'https:' &&
            (production ||
              url.protocol !== 'http:' ||
              !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error('Invalid AUTH_ORIGINS; configure explicit web origins (HTTPS in production)');
  const secure = production || origins.every((origin) => origin.startsWith('https:'));
  return { secure, cookieName: secure ? '__Host-hhp_session' : 'hhp_session', origins };
}
