import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { focusManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { BrowserRouter, useRoutes } from 'react-router';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from '../../app/App';
import { AppProviders } from '../../app/providers';
import { routes } from '../../app/routes';
import { HttpError } from '../../lib/http';
import { useSession, type Session } from './hooks/use-session';
import type { AuthUser } from './schemas/auth';

const observer: AuthUser = {
  id: 'synthetic-observer',
  username: 'observer',
  fullName: 'Persona de prueba',
  role: 'OBSERVADOR',
  permissions: ['attendance:read-own'],
  mustChangePassword: false,
};
const admin: AuthUser = {
  ...observer,
  id: 'synthetic-admin',
  username: 'admin',
  fullName: 'Administración de prueba',
  role: 'ADMIN',
  permissions: ['users:read', 'observers:read'],
};
const unauthorized = () => new Response(null, { status: 401 });
const noContent = () => new Response(null, { status: 204 });

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fields(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submitLogin() {
  fields({ Usuario: 'observer', Contraseña: 'synthetic-password' });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

it('restores the session without flashing private content, including StrictMode', async () => {
  const response = deferred<Response>();
  vi.stubGlobal(
    'fetch',
    vi.fn((_path, options) => {
      // StrictMode may cancel its first bootstrap request.
      if (options.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      return response.promise.then((result) => result.clone());
    }),
  );
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  expect(screen.getByRole('status').textContent).toBe('Verificando sesión…');
  expect(screen.queryByText('Sesión activa')).toBeNull();
  response.resolve(Response.json(observer));
  await screen.findByRole('heading', { name: 'Sesión activa' });
  expect(screen.getByText('Persona de prueba · OBSERVADOR')).toBeTruthy();
});

it('redirects anonymous protected navigation and logs in with JSON/CSRF then rereads me', async () => {
  let user: AuthUser | null = null;
  const fetchMock = vi.fn(async (path, _options) => {
    if (path === '/api/auth/login') {
      user = observer;
      return Response.json({ authenticated: true });
    }
    if (path === '/api/auth/me') return user ? Response.json(user) : unauthorized();
    throw new Error('Unexpected request');
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  expect(window.location.pathname).toBe('/login');
  submitLogin();
  await screen.findByRole('heading', { name: 'Sesión activa' });
  const [, options] = fetchMock.mock.calls.find(([path]) => path === '/api/auth/login')!;
  expect(options).toMatchObject({
    method: 'POST',
    credentials: 'same-origin',
    body: '{"username":"observer","password":"synthetic-password"}',
  });
  expect(options.headers.get('X-HHP-CSRF')).toBe('1');
  expect(options.headers.get('Content-Type')).toBe('application/json');
  expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/me')).toHaveLength(2);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it.each([401, 429, 403])('keeps login failures visible without retrying (%s)', async (status) => {
  const fetchMock = vi.fn<typeof fetch>(async (path) =>
    path === '/api/auth/me' ? unauthorized() : new Response(null, { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  submitLogin();
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeTruthy();
  expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/login')).toHaveLength(1);
  expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Usuario') as HTMLInputElement).value).toBe('observer');
});

it('distinguishes bootstrap/network failures from anonymous status', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('Offline'));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByRole('heading', { name: 'No se pudo verificar la sesión' });
  expect(screen.queryByText('Sesión activa')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockResolvedValue(Response.json(observer));
  fireEvent.click(screen.getByRole('button', { name: 'Volver a verificar' }));
  await screen.findByRole('heading', { name: 'Sesión activa' });
});

it('validates login input without sending credentials and blocks duplicate submissions', async () => {
  const pending = deferred<Response>();
  const fetchMock = vi.fn(async (path) =>
    path === '/api/auth/me' ? unauthorized() : pending.promise,
  );
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await screen.findByText('Escribe tu contraseña.');
  expect(fetchMock.mock.calls.some(([path]) => path === '/api/auth/login')).toBe(false);
  submitLogin();
  await screen.findByRole('button', { name: 'Iniciando sesión…' });
  expect(
    (screen.getByRole('button', { name: 'Iniciando sesión…' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Iniciando sesión…' }));
  pending.resolve(unauthorized());
  await screen.findByRole('alert');
  expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/login')).toHaveLength(1);
});

it('enforces mandatory password change, validates confirmation and requires a fresh login', async () => {
  const fetchMock = vi.fn<typeof fetch>(async (path) =>
    path === '/api/auth/me'
      ? Response.json({ ...observer, mustChangePassword: true })
      : noContent(),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByRole('heading', { name: 'Cambiar contraseña' });
  expect(window.location.pathname).toBe('/cambiar-contrasena');
  expect(screen.queryByRole('navigation', { name: 'Sesión' })).toBeNull();
  fields({
    'Contraseña actual': 'synthetic-old',
    'Nueva contraseña (15 a 128 caracteres)': 'synthetic-new-password',
    'Confirmar nueva contraseña': 'different-password',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
  await screen.findByText('Las contraseñas no coinciden.');
  expect(fetchMock.mock.calls.some(([path]) => path === '/api/auth/change-password')).toBe(false);
  fields({ 'Confirmar nueva contraseña': 'synthetic-new-password' });
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  expect(screen.getByText(/Contraseña actualizada/)).toBeTruthy();
  const [, options] = fetchMock.mock.calls.find(([path]) => path === '/api/auth/change-password')!;
  if (typeof options?.body !== 'string') throw new Error('Expected a JSON request body');
  expect(JSON.parse(options.body)).toEqual({
    currentPassword: 'synthetic-old',
    newPassword: 'synthetic-new-password',
  });
});

it('revalidates a 401 during password change rather than assuming expiration', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path) =>
      path === '/api/auth/me'
        ? Response.json({ ...observer, mustChangePassword: true })
        : unauthorized(),
    ),
  );
  render(<App />);
  await screen.findByRole('heading', { name: 'Cambiar contraseña' });
  fields({
    'Contraseña actual': 'synthetic-wrong',
    'Nueva contraseña (15 a 128 caracteres)': 'synthetic-new-password',
    'Confirmar nueva contraseña': 'synthetic-new-password',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'Cambiar contraseña' })).toBeTruthy();
});

it('hides private content immediately during logout and supports retry on uncertain failure', async () => {
  const result = deferred<Response>();
  const fetchMock = vi.fn<typeof fetch>(async (path) =>
    path === '/api/auth/me' ? Response.json(admin) : result.promise,
  );
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByRole('heading', { name: 'Sesión activa' });
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(screen.queryByText('Administración de prueba · ADMIN')).toBeNull();
  result.resolve(new Response(null, { status: 503 }));
  await screen.findByRole('heading', { name: 'Cierre de sesión sin confirmar' });
  expect(screen.queryByRole('heading', { name: 'Sesión activa' })).toBeNull();
  fetchMock.mockResolvedValue(noContent());
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar cierre de sesión' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  const [, options] = fetchMock.mock.calls.find(([path]) => path === '/api/auth/logout')!;
  expect(options).toMatchObject({ body: '{}', credentials: 'same-origin' });
});

it.each([
  [observer, 'Asistencia personal', 'Cuentas · Próximamente'],
  [{ ...admin, role: 'ENLACE' }, 'Observadores', 'Cuentas · Próximamente'],
  [admin, 'Cuentas', 'Asistencia personal'],
])(
  'renders only effective role/permission capabilities for $role',
  async (user, present, absent) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(user)));
    render(<App />);
    await screen.findByText(present);
    expect(screen.queryByText(absent)).toBeNull();
  },
);

let activeClient: QueryClient;
let activeSession: Session;
function Capture() {
  const client = useQueryClient();
  const session = useSession();
  useEffect(() => {
    activeClient = client;
    activeSession = session;
  });
  return null;
}
function TestRoutes() {
  return useRoutes(routes);
}
function renderCaptured() {
  return render(
    <AppProviders>
      <Capture />
      <BrowserRouter>
        <TestRoutes />
      </BrowserRouter>
    </AppProviders>,
  );
}

it.each([401, 403])(
  'clears expired/revoked scopes but does not treat ordinary 403 as logout (%s)',
  async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(observer)));
    renderCaptured();
    await screen.findByRole('heading', { name: 'Sesión activa' });
    const previous = activeClient;
    activeClient.setQueryData(['private'], { synthetic: true });
    await act(async () => {
      await activeClient
        .fetchQuery({
          queryKey: ['denied'],
          queryFn: async () => {
            throw new HttpError(status);
          },
        })
        .catch(() => {});
    });
    if (status === 401) {
      await screen.findByRole('heading', { name: 'Iniciar sesión' });
      expect(activeClient).not.toBe(previous);
      expect(previous.getQueryData(['private'])).toBeUndefined();
      expect(screen.getByText(/expiró o fue revocada/)).toBeTruthy();
    } else {
      expect(activeClient).toBe(previous);
      expect(screen.getByRole('heading', { name: 'Sesión activa' })).toBeTruthy();
    }
  },
);

it('clears private scopes on PASSWORD_CHANGE_REQUIRED and rereads the server projection', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(observer));
  vi.stubGlobal('fetch', fetchMock);
  renderCaptured();
  await screen.findByRole('heading', { name: 'Sesión activa' });
  const previous = activeClient;
  fetchMock.mockResolvedValue(Response.json({ ...observer, mustChangePassword: true }));
  await act(async () => {
    await activeClient
      .fetchQuery({
        queryKey: ['required'],
        queryFn: async () => {
          throw new HttpError(403, 'PASSWORD_CHANGE_REQUIRED');
        },
      })
      .catch(() => {});
  });
  await screen.findByRole('heading', { name: 'Cambiar contraseña' });
  expect(activeClient).not.toBe(previous);
});

it.each([401, 403])(
  'handles private mutation authorization failures without conflating statuses (%s)',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => Response.json(observer)),
    );
    renderCaptured();
    await screen.findByRole('heading', { name: 'Sesión activa' });
    const previous = activeClient;
    previous.setQueryData(['private'], 'synthetic');
    await act(async () => {
      await previous
        .getMutationCache()
        .build(previous, {
          mutationFn: async () => {
            throw new HttpError(status);
          },
        })
        .execute(undefined)
        .catch(() => {});
    });
    if (status === 401) {
      await screen.findByRole('heading', { name: 'Iniciar sesión' });
      expect(activeClient).not.toBe(previous);
      expect(previous.getQueryData(['private'])).toBeUndefined();
    } else {
      expect(activeClient).toBe(previous);
      expect(screen.getByRole('heading', { name: 'Sesión activa' })).toBeTruthy();
    }
  },
);

it('does not carry a password-action error into an expired-session login', async () => {
  let reads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path) =>
      path === '/api/auth/me' && reads++ === 0
        ? Response.json({ ...observer, mustChangePassword: true })
        : unauthorized(),
    ),
  );
  render(<App />);
  await screen.findByRole('heading', { name: 'Cambiar contraseña' });
  fields({
    'Contraseña actual': 'synthetic-wrong',
    'Nueva contraseña (15 a 128 caracteres)': 'synthetic-new-password',
    'Confirmar nueva contraseña': 'synthetic-new-password',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  expect(screen.queryByText(/No se pudo cambiar la contraseña/)).toBeNull();
  expect(screen.getByText(/expiró o fue revocada/)).toBeTruthy();
});

it('isolates late query and mutation completions from the next account', async () => {
  let user: AuthUser | null = observer;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path) => {
      if (path === '/api/auth/me') return user ? Response.json(user) : unauthorized();
      if (path === '/api/auth/logout') {
        user = null;
        return noContent();
      }
      if (path === '/api/auth/login') {
        user = admin;
        return Response.json({ authenticated: true });
      }
      throw new Error('Unexpected request');
    }),
  );
  renderCaptured();
  await screen.findByRole('heading', { name: 'Sesión activa' });
  const old = activeClient;
  const pending = deferred<string>();
  const late = old
    .fetchQuery({ queryKey: ['late-private'], queryFn: () => pending.promise })
    .catch(() => {});
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  submitLogin();
  await screen.findByText('Administración de prueba · ADMIN');
  await act(async () => {
    pending.resolve('old synthetic private data');
    await late;
    old.setQueryData(['late-mutation'], 'old callback');
  });
  expect(activeClient).not.toBe(old);
  expect(activeClient.getQueryData(['late-private'])).toBeUndefined();
  expect(activeClient.getQueryData(['late-mutation'])).toBeUndefined();
  expect(activeClient.getMutationCache().getAll()).toHaveLength(0);
});

it('blocks stale data during revalidation and isolates a changed account on focus', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(observer));
  vi.stubGlobal('fetch', fetchMock);
  renderCaptured();
  await screen.findByRole('heading', { name: 'Sesión activa' });
  const previous = activeClient;
  previous.setQueryData(['private'], 'old data');
  const next = deferred<Response>();
  fetchMock.mockImplementation(() => next.promise);
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  await waitFor(() => expect(screen.queryByText('Persona de prueba · OBSERVADOR')).toBeNull());
  next.resolve(Response.json(admin));
  await screen.findByText('Administración de prueba · ADMIN');
  expect(activeClient).not.toBe(previous);
  expect(activeClient.getQueryData(['private'])).toBeUndefined();
  expect(activeSession.user?.id).toBe(admin.id);
});

it('removes private state when focus revalidation finds a revoked session', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json(observer));
  vi.stubGlobal('fetch', fetchMock);
  renderCaptured();
  await screen.findByRole('heading', { name: 'Sesión activa' });
  const previous = activeClient;
  previous.setQueryData(['private'], 'synthetic');
  fetchMock.mockImplementation(async () => unauthorized());
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  expect(previous.getQueryData(['private'])).toBeUndefined();
});
