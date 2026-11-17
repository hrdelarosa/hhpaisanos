import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { focusManager, useQuery } from '@tanstack/react-query';
import { lazy, type ComponentType } from 'react';
import { BrowserRouter, useRoutes } from 'react-router';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { http } from '../lib/http';
import { AuthenticatedLayout } from '../modules/auth/components/AuthenticatedLayout';
import { RequireSession } from '../modules/auth/components/RequireSession';
import { useSession } from '../modules/auth/hooks/use-session';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { SessionHomePage } from '../modules/auth/pages/SessionHomePage';
import type { AuthUser } from '../modules/auth/schemas/auth';
import { OperativesLayout } from '../modules/operatives/components/OperativesLayout';
import { AppProviders } from './providers';
import { AppLayout } from './layouts/AppLayout';

const admin: AuthUser = {
  id: 'synthetic-admin',
  username: 'admin',
  fullName: 'Cuenta anterior',
  role: 'ADMIN',
  permissions: ['operatives:read'],
  mustChangePassword: false,
};
let current: AuthUser | null;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function PrivatePage() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ['lazy-probe'],
    queryFn: ({ signal }) => http('/api/operatives', { signal }),
  });
  return (
    <section>
      <h1>Operativos de prueba</h1>
      <p>{query.isSuccess ? `Contenido privado de ${user?.fullName}` : 'Consultando registros…'}</p>
      <button>Acción de prueba</button>
    </section>
  );
}

function setup(Page: ComponentType, user: AuthUser | null = admin) {
  current = user;
  const fetchMock = vi.fn(async (path: string) => {
    if (path === '/api/auth/me')
      return current ? Response.json(current) : new Response(null, { status: 401 });
    if (path === '/api/auth/logout') {
      current = null;
      return new Response(null, { status: 204 });
    }
    if (path === '/api/auth/login') {
      current = { ...admin, id: 'next-admin', fullName: 'Cuenta nueva' };
      return Response.json({ authenticated: true });
    }
    if (path === '/api/operatives') return Response.json({ items: [] });
    throw new Error(`Unexpected endpoint: ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/operativos');
  function TestRoutes() {
    return useRoutes([
      {
        element: <AppLayout />,
        children: [
          {
            element: <RequireSession />,
            children: [
              {
                element: <AuthenticatedLayout />,
                children: [
                  { index: true, element: <SessionHomePage /> },
                  {
                    path: 'operativos',
                    element: <OperativesLayout />,
                    children: [{ index: true, element: <Page /> }],
                  },
                ],
              },
            ],
          },
          { path: 'login', element: <LoginPage /> },
        ],
      },
    ]);
  }
  render(
    <AppProviders>
      <BrowserRouter>
        <TestRoutes />
      </BrowserRouter>
    </AppProviders>,
  );
  return fetchMock;
}

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

it('keeps navigation/logout usable while loading, then reuses the lazy module on return', async () => {
  const pending = deferred<{ default: ComponentType }>();
  const load = vi.fn(() => pending.promise);
  setup(lazy(load));
  expect(await screen.findByText('Cargando sección…')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Inicio' }));
  await screen.findByRole('heading', { name: 'Sesión activa' });
  await act(async () => pending.resolve({ default: PrivatePage }));
  fireEvent.click(screen.getByRole('link', { name: 'Operativos' }));
  await screen.findByText('Contenido privado de Cuenta anterior');
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Operativos de prueba' }),
    ),
  );
  expect(document.title).toBe('Operativos de prueba | Heroínas y Héroes Paisanos');
  expect(load).toHaveBeenCalledTimes(1);
});

it('handles rejected imports without exposing errors or retrying writes/imports, and can leave the error', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const load = vi.fn(() => Promise.reject(new Error('synthetic-internal-error')));
  const fetchMock = setup(lazy(load));
  await screen.findByRole('heading', { name: 'No se pudo cargar esta sección' });
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'No se pudo cargar esta sección' }),
    ),
  );
  expect(document.title).toContain('No se pudo cargar esta sección');
  expect(screen.getByRole('alert').textContent).toContain('recarga esta página manualmente');
  expect(screen.queryByText('synthetic-internal-error')).toBeNull();
  expect(window.location.pathname).toBe('/operativos');
  fireEvent.click(screen.getByRole('link', { name: 'Inicio' }));
  await screen.findByRole('heading', { name: 'Sesión activa' });
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Sesión activa' })),
  );
  fireEvent.click(screen.getByRole('link', { name: 'Operativos' }));
  await screen.findByRole('heading', { name: 'No se pudo cargar esta sección' });
  expect(load).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls.every(([path]) => path === '/api/auth/me')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Iniciar sesión' })),
  );
});

it('does not load a denied route or issue its private API request', async () => {
  const load = vi.fn(async () => ({ default: PrivatePage }));
  const fetchMock = setup(lazy(load), { ...admin, permissions: [] });
  await screen.findByText('No tienes permiso para esta sección de operativos.');
  expect(load).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls.every(([path]) => path === '/api/auth/me')).toBe(true);
});

it('does not mount a resolved private module after logout during its pending import', async () => {
  const pending = deferred<{ default: ComponentType }>();
  const fetchMock = setup(lazy(() => pending.promise));
  await screen.findByText('Cargando sección…');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  await act(async () => pending.resolve({ default: PrivatePage }));
  expect(screen.queryByText(/Contenido privado/)).toBeNull();
  expect(fetchMock.mock.calls.some(([path]) => path === '/api/operatives')).toBe(false);
});

it.each(['revoked', 'permissions-changed'] as const)(
  'discards pending route content when the session is %s',
  async (change) => {
    const pending = deferred<{ default: ComponentType }>();
    const fetchMock = setup(lazy(() => pending.promise));
    await screen.findByText('Cargando sección…');
    current = change === 'revoked' ? null : { ...admin, permissions: [] };
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    if (change === 'revoked') await screen.findByRole('heading', { name: 'Iniciar sesión' });
    else await screen.findByText('No tienes permiso para esta sección de operativos.');
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain(
        change === 'revoked' ? 'Iniciar sesión' : 'No tienes permiso',
      ),
    );
    await act(async () => pending.resolve({ default: PrivatePage }));
    expect(screen.queryByText(/Contenido privado/)).toBeNull();
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/operatives')).toBe(false);
  },
);

it.each([false, true])(
  'resolves only the new account and respects subsequent focus intent (%s)',
  async (movedFocus) => {
    const pending = deferred<{ default: ComponentType }>();
    const load = vi.fn(() => pending.promise);
    const fetchMock = setup(lazy(load));
    await screen.findByText('Cargando sección…');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'next-admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'synthetic-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await screen.findByRole('heading', { name: 'Sesión activa' });
    fireEvent.click(screen.getByRole('link', { name: 'Operativos' }));
    await screen.findByText('Cargando sección…');
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/operatives')).toBe(false);
    const logout = screen.getByRole('button', { name: 'Cerrar sesión' });
    if (movedFocus) logout.focus();
    await act(async () => pending.resolve({ default: PrivatePage }));
    await screen.findByText('Contenido privado de Cuenta nueva');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        movedFocus ? logout : screen.getByRole('heading', { name: 'Operativos de prueba' }),
      ),
    );
    expect(screen.queryByText('Contenido privado de Cuenta anterior')).toBeNull();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(localStorage.length + sessionStorage.length).toBe(0);
  },
);

it.each(['success', 'failure'] as const)(
  'does not steal focus after delayed lazy %s',
  async (outcome) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let reject!: (reason: Error) => void;
    const pending = deferred<{ default: ComponentType }>();
    const result = new Promise<{ default: ComponentType }>((resolve, fail) => {
      void pending.promise.then(resolve);
      reject = fail;
    });
    setup(lazy(() => result));
    await screen.findByText('Cargando sección…');
    expect(document.activeElement).toBe(document.body);
    expect(document.title).toContain('Cargando sección');
    const logout = screen.getByRole('button', { name: 'Cerrar sesión' });
    logout.focus();
    await act(async () => {
      if (outcome === 'success') pending.resolve({ default: PrivatePage });
      else reject(new Error('synthetic failure'));
    });
    await screen.findByRole('heading', {
      name: outcome === 'success' ? 'Operativos de prueba' : 'No se pudo cargar esta sección',
    });
    expect(document.activeElement).toBe(logout);
    expect(document.title).toContain(
      outcome === 'success' ? 'Operativos de prueba' : 'No se pudo cargar esta sección',
    );
  },
);
