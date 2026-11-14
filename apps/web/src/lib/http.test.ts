import { afterEach, expect, it, vi } from 'vite-plus/test';
import { http, HttpError } from './http';

afterEach(() => vi.unstubAllGlobals());

it('does not expose response fragments when successful JSON is malformed', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive synthetic content')));
  await expect(http('/api/example')).rejects.toThrow(
    'La API devolvió una respuesta JSON inválida.',
  );
});

it('preserves an abort while an HTTP error body is being consumed', async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => {
        controller.abort();
        return { code: 'VERSION_CONFLICT' };
      },
    }),
  );
  await expect(http('/api/example', { signal: controller.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
});

it('sends JSON mutations with same-origin cookies and enforced CSRF headers', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(
    http('/api/example', {
      method: 'POST',
      body: { reason: 'Synthetic test' },
      headers: { 'X-HHP-CSRF': 'invalid', 'Idempotency-Key': 'test-key' },
    }),
  ).resolves.toBeUndefined();
  const [path, options] = fetchMock.mock.calls[0];
  expect(path).toBe('/api/example');
  expect(options).toMatchObject({
    method: 'POST',
    body: '{"reason":"Synthetic test"}',
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
  });
  expect(options.headers.get('Content-Type')).toBe('application/json');
  expect(options.headers.get('X-HHP-CSRF')).toBe('1');
  expect(options.headers.get('Idempotency-Key')).toBe('test-key');
});

it('sends an empty JSON object for bodyless mutations', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(http('/api/example', { method: 'DELETE' })).resolves.toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledWith('/api/example', expect.objectContaining({ body: '{}' }));
});

it.each([
  [
    'JSON',
    () => Response.json({ code: 'VERSION_CONFLICT', message: 'Do not retain' }, { status: 409 }),
    'VERSION_CONFLICT',
  ],
  ['non-JSON', () => new Response('Proxy failure', { status: 502 }), undefined],
])('normalizes %s HTTP errors without retaining response bodies', async (_name, response, code) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  const error = await http('/api/example').catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpError);
  expect(error).toMatchObject({ status: code ? 409 : 502, code });
  expect(error).not.toHaveProperty('body');
  expect(String(error)).not.toContain('Do not retain');
});

it('preserves cancellation and does not retry uncertain writes', async () => {
  const controller = new AbortController();
  const error = new DOMException('Aborted', 'AbortError');
  const fetchMock = vi.fn().mockRejectedValue(error);
  vi.stubGlobal('fetch', fetchMock);
  controller.abort();
  await expect(http('/api/example', { method: 'POST', signal: controller.signal })).rejects.toBe(
    error,
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/example',
    expect.objectContaining({ signal: controller.signal }),
  );
});

it.each([
  'https://example.com/api/test',
  '//example.com/api/test',
  '/other',
  '/api/../other',
  '/api/../../other',
])('rejects requests outside the API boundary: %s', async (path) => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  await expect(http(path)).rejects.toBeInstanceOf(TypeError);
  expect(fetchMock).not.toHaveBeenCalled();
});
