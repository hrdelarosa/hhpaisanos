type HttpOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`La solicitud no se pudo completar (HTTP ${status}).`);
    this.name = 'HttpError';
  }
}

/** Returns unknown so each module validates its own response contract. */
export async function http(path: string, options: HttpOptions = {}): Promise<unknown> {
  const url = new URL(path, window.location.origin);
  if (
    !path.startsWith('/api/') ||
    url.origin !== window.location.origin ||
    !url.pathname.startsWith('/api/')
  ) {
    throw new TypeError('Only same-origin /api/ requests are supported');
  }

  const { method = 'GET', body, signal } = options;
  if (method === 'GET' && body !== undefined) {
    throw new TypeError('GET requests cannot contain a body');
  }
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (method !== 'GET') {
    headers.set('Content-Type', 'application/json');
    headers.set('X-HHP-CSRF', '1');
  }

  const response = await fetch(url.pathname + url.search, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    signal,
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
  });

  if (!response.ok) {
    // Never retain raw response bodies, which may contain sensitive input.
    let code: string | undefined;
    try {
      const error: unknown = await response.json();
      if (typeof error === 'object' && error !== null && 'code' in error) {
        if (typeof error.code === 'string') code = error.code;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
    signal?.throwIfAborted();
    throw new HttpError(response.status, code);
  }

  if (response.status === 204) return undefined;
  try {
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    // JSON parser messages can quote fragments of sensitive responses.
    throw new Error('La API devolvió una respuesta JSON inválida.');
  }
}
