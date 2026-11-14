import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from './app/App';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './lib/query-client';
import { HealthPage } from './modules/health/pages/HealthPage';

function renderHealth() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <HealthPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

it('shows loading and then the API connection status', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'ok' }));
  vi.stubGlobal('fetch', fetchMock);
  renderHealth();
  expect(screen.getByRole('status').textContent).toContain('Verificando');
  await screen.findByText('API conectada.');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/health',
    expect.objectContaining({ signal: expect.any(AbortSignal), credentials: 'same-origin' }),
  );
});

it.each([
  ['network failure', () => Promise.reject(new Error('Offline'))],
  ['HTTP failure', () => Promise.resolve(new Response(null, { status: 503 }))],
  ['invalid response', () => Promise.resolve(Response.json({ status: 'unexpected' }))],
])('shows an error on %s', async (_name, response) => {
  vi.stubGlobal('fetch', vi.fn(response));
  renderHealth();
  await screen.findByText('No se pudo conectar con la API.');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('renders an unknown route without fetching private resources', () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/no-existe');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/');
  expect(fetchMock.mock.calls.every(([path]) => path === '/api/auth/me')).toBe(true);
});
