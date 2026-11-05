import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows loading and then the API connection status', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'ok' }));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  expect(screen.getByRole('status').textContent).toContain('Verificando');
  await screen.findByText('API conectada.');
  expect(fetchMock).toHaveBeenCalledWith('/api/health', { signal: expect.any(AbortSignal) });
});

it.each([
  ['network failure', () => Promise.reject(new Error('Offline'))],
  ['HTTP failure', () => Promise.resolve(new Response(null, { status: 503 }))],
  ['invalid response', () => Promise.resolve(Response.json({ status: 'unexpected' }))],
])('shows an error on %s', async (_name, response) => {
  vi.stubGlobal('fetch', vi.fn(response));
  render(<App />);
  await screen.findByText('No se pudo conectar con la API.');
});
