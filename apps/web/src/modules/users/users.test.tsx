import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from '../../app/App';
import { createUserSchema, userSchema } from './schemas/users';

const id = '019a7fb0-0000-7000-8000-000000000001';
const roleId = '019a7fb0-0000-7000-8000-000000000002';
const account = {
  id,
  username: 'Exact %_!',
  fullName: 'Persona sintética',
  roleId,
  role: 'OBSERVADOR',
  active: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-11-15 10:00:00.123456',
  updatedAt: '2026-11-15 10:00:00.123456',
};
const session = {
  id: 'synthetic-admin',
  username: 'admin',
  fullName: 'Admin sintético',
  role: 'ADMIN',
  permissions: ['users:read', 'users:create', 'users:update', 'users:change-status', 'roles:read'],
  mustChangePassword: false,
};
const roles = [
  { id: roleId, code: 'OBSERVADOR', name: 'Observador', description: null, active: true },
];
const list = { items: [account], page: 1, pageSize: 20, total: 1 };
type Handler = (url: string, options?: RequestInit) => Response | Promise<Response>;
function mount(
  path: string,
  handler: Handler = (url) =>
    Response.json(url === '/api/roles' ? roles : url.includes('?') ? list : account),
  user = session,
) {
  window.history.replaceState(null, '', path);
  const mock = vi.fn<typeof fetch>(async (url, options) =>
    url === '/api/auth/me'
      ? Response.json(user)
      : handler(url instanceof Request ? url.url : url.toString(), options),
  );
  vi.stubGlobal('fetch', mock);
  render(<App />);
  return mock;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});
const writes = (mock: ReturnType<typeof mount>) =>
  mock.mock.calls.filter(([, options]) => ['POST', 'PATCH', 'PUT'].includes(options?.method ?? ''));
async function fillCreate() {
  await screen.findByLabelText('Nombre de usuario');
  fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: '  nuevo  ' } });
  fireEvent.change(screen.getByLabelText('Nombre completo de la cuenta'), {
    target: { value: '  Nombre exacto  ' },
  });
  fireEvent.change(screen.getByLabelText('Rol inicial'), { target: { value: roleId } });
}
async function prepare(operation = 'status') {
  await screen.findByRole('heading', { name: `Cuenta: ${account.username}` });
  if (operation === 'edit')
    fireEvent.change(screen.getByLabelText('Nuevo nombre completo'), {
      target: { value: 'Nombre corregido' },
    });
  fireEvent.change(
    screen.getByLabelText(
      operation === 'edit' ? 'Motivo de edición de cuenta' : 'Motivo del estado de cuenta',
    ),
    { target: { value: 'Solicitud autorizada' } },
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: operation === 'edit' ? 'Revisar edición de cuenta' : 'Revisar desactivación de cuenta',
    }),
  );
  await screen.findByRole('heading', { name: 'Revisar cambio de cuenta' });
}
it('lists actual account status, preserves URL filters and does not expose extra response fields', async () => {
  mount('/cuentas?active=true', (url) =>
    Response.json(
      url.includes('?')
        ? { ...list, items: [{ ...account, passwordHash: 'hidden', sessionSecret: 'hidden' }] }
        : account,
    ),
  );
  await screen.findByRole('rowheader', { name: account.username });
  expect(screen.getByRole('cell', { name: 'Activa' })).toBeTruthy();
  expect(screen.queryByText('hidden')).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: `Ver cuenta ${account.username}` }));
  await screen.findByText('Sin acceso registrado');
  expect(screen.getAllByText(account.createdAt)).toHaveLength(2);
  fireEvent.click(screen.getByRole('link', { name: 'Volver a cuentas' }));
  await screen.findByRole('rowheader');
  expect(window.location.search).toBe('?active=true');
  expect(userSchema.parse({ ...account, passwordHash: 'secret' })).toEqual(account);
});
it('filters supported parameters, literal search, role, pagination and URL bounds', async () => {
  const mock = mount('/cuentas?page=2&pageSize=1', (url) =>
    Response.json({
      ...list,
      page: Number(new URL(url, location.origin).searchParams.get('page')),
      pageSize: 1,
      total: 3,
    }),
  );
  await screen.findByRole('rowheader');
  fireEvent.change(screen.getByLabelText('Buscar por usuario o nombre'), {
    target: { value: '%_!' },
  });
  await waitFor(() => expect(location.search).toContain('search=%25_!'));
  await waitFor(() =>
    expect(
      mock.mock.calls.some(([url]) => typeof url === 'string' && url.includes('search=%25_%21')),
    ).toBe(true),
  );
  fireEvent.change(screen.getByLabelText('Identificador de rol (UUIDv7)'), {
    target: { value: roleId },
  });
  await waitFor(() => expect(location.search).toContain(roleId));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await waitFor(() => expect(location.search).toContain('page=2'));
});
it.each([
  { ...session, permissions: [] },
  { ...session, role: 'ENLACE' },
  { ...session, role: 'OBSERVADOR' },
])('denies Users without both ADMIN and explicit grant ($role)', async (user) => {
  const mock = mount('/cuentas', undefined, user);
  await screen.findByText(/No tienes permiso para esta sección de cuentas/);
  expect(mock.mock.calls.filter(([url]) => url !== '/api/auth/me')).toHaveLength(0);
});
it('keeps read-only sessions and protected ADMIN accounts free of mutation controls', async () => {
  mount(`/cuentas/${id}`, () => Response.json({ ...account, role: 'ADMIN' }));
  await screen.findByText(/Cuenta protegida/);
  expect(screen.queryByLabelText('Nuevo nombre completo')).toBeNull();
  expect(screen.queryByRole('button', { name: /restablecer|rol/i })).toBeNull();
});
it('requires the authorized role catalog for creation', async () => {
  const mock = mount('/cuentas/nueva', undefined, { ...session, permissions: ['users:create'] });
  await screen.findByText(/se necesita también roles:read/);
  expect(writes(mock)).toHaveLength(0);
});
it('creates through the existing endpoint, preserving spelling and showing a dismissible one-time credential', async () => {
  const mock = mount('/cuentas/nueva', (url) =>
    Response.json(
      url === '/api/roles'
        ? [...roles, { ...roles[0], id, code: 'ADMIN' }]
        : { id, temporaryPassword: 'synthetic-one-time-password' },
    ),
  );
  await fillCreate();
  expect(screen.queryByRole('option', { name: 'ADMIN' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  await screen.findByRole('heading', { name: 'Cuenta creada' });
  expect(writes(mock)).toHaveLength(1);
  expect(JSON.parse(writes(mock)[0][1]?.body as string)).toEqual({
    username: '  nuevo  ',
    fullName: '  Nombre exacto  ',
    roleId,
  });
  expect((screen.getByLabelText('Contraseña temporal') as HTMLInputElement).type).toBe('password');
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña temporal' }));
  expect((screen.getByLabelText('Contraseña temporal') as HTMLInputElement).type).toBe('text');
  fireEvent.click(screen.getByRole('button', { name: 'Enmascarar contraseña temporal' }));
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar credencial definitivamente' }));
  expect(screen.queryByLabelText('Contraseña temporal')).toBeNull();
});
it('locks uncertain creation without retry and explains the lost credential limitation', async () => {
  const mock = mount('/cuentas/nueva', (url) => {
    if (url === '/api/roles') return Response.json(roles);
    throw new TypeError('lost response');
  });
  await fillCreate();
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  await screen.findByText(/No vuelvas a crear/);
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  expect(writes(mock)).toHaveLength(1);
});
it.each([400, 403, 409, 429])('reports rejected creation separately (%s)', async (status) => {
  mount('/cuentas/nueva', (url) =>
    url === '/api/roles' ? Response.json(roles) : Response.json({}, { status }),
  );
  await fillCreate();
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  await screen.findByRole('alert');
  expect(screen.queryByText(/No vuelvas a crear/)).toBeNull();
});
it.each(['edit', 'status'])(
  'confirms supported %s and refreshes server state without optimistic updates',
  async (operation) => {
    let current = { ...account };
    const mock = mount(`/cuentas/${id}`, (_url, options) => {
      if (options?.method === 'PATCH') {
        const body = JSON.parse(options.body as string);
        current = {
          ...current,
          ...(operation === 'edit' ? { fullName: body.fullName } : { active: body.active }),
        };
        return new Response(null, { status: 204 });
      }
      return Response.json(current);
    });
    await prepare(operation);
    expect(writes(mock)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de cuenta' }));
    await screen.findByText('Cambio de cuenta confirmado por el servidor.');
    await screen.findByText(operation === 'edit' ? 'Nombre corregido' : 'Inactiva');
    expect(writes(mock)).toHaveLength(1);
    expect(new Headers(writes(mock)[0][1]?.headers).get('X-HHP-CSRF')).toBe('1');
  },
);
it.each(['edit', 'status'])('blocks stale %s at final confirmation', async (operation) => {
  let current = { ...account };
  const mock = mount(`/cuentas/${id}`, () => Response.json(current));
  await prepare(operation);
  current = { ...current, fullName: 'Cambio concurrente' };
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de cuenta' }));
  await screen.findByText(/La cuenta cambió/);
  expect(writes(mock)).toHaveLength(0);
});
it('distinguishes a failed preflight from uncertain writes', async () => {
  let fail = false;
  const mock = mount(`/cuentas/${id}`, () => {
    if (fail) throw new TypeError('offline');
    return Response.json(account);
  });
  await prepare();
  fail = true;
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de cuenta' }));
  await screen.findByText(/No se envió ningún cambio/);
  expect(writes(mock)).toHaveLength(0);
});
it('reconciles committed status after response loss, without claiming success or retry', async () => {
  let current = { ...account };
  const mock = mount(`/cuentas/${id}`, (_url, options) => {
    if (options?.method === 'PATCH') {
      current.active = false;
      throw new TypeError('lost');
    }
    return Response.json(current);
  });
  await prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de cuenta' }));
  await screen.findByText(/No se confirmó el resultado/);
  await screen.findByText('Inactiva');
  expect(writes(mock)).toHaveLength(1);
  expect(screen.queryByText('Cambio de cuenta confirmado por el servidor.')).toBeNull();
});
it.each(['empty', 'error', 'loading'])('renders %s account lists', async (state) => {
  mount('/cuentas', () =>
    state === 'loading'
      ? new Promise(() => {})
      : state === 'error'
        ? Response.json({}, { status: 500 })
        : Response.json({ ...list, items: [], total: 0 }),
  );
  await screen.findByText(
    state === 'loading'
      ? 'Cargando cuentas…'
      : state === 'error'
        ? 'No se pudo consultar la cuenta. Reintenta la consulta.'
        : 'No hay cuentas en esta página para los filtros seleccionados.',
  );
});
it('does not leak late creation credentials after logout/account isolation', async () => {
  let resolve!: (response: Response) => void;
  const mock = mount('/cuentas/nueva', (url) =>
    url === '/api/roles'
      ? Response.json(roles)
      : url === '/api/auth/logout'
        ? new Response(null, { status: 204 })
        : new Promise((r) => {
            resolve = r;
          }),
  );
  await fillCreate();
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  await waitFor(() => expect(writes(mock)).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  await act(async () =>
    resolve(Response.json({ id, temporaryPassword: 'never-show-late-secret' })),
  );
  expect(screen.queryByLabelText('Contraseña temporal')).toBeNull();
});
it('validates Unicode code points and untrimmed account input', () => {
  expect(
    createUserSchema.safeParse({ username: '😀'.repeat(50), fullName: '  Nombre  ', roleId })
      .success,
  ).toBe(true);
  expect(
    createUserSchema.safeParse({ username: '😀'.repeat(51), fullName: 'Nombre', roleId }).success,
  ).toBe(false);
  expect(createUserSchema.safeParse({ username: '  ', fullName: 'Nombre', roleId }).success).toBe(
    false,
  );
});

it.each(['/cuentas/nueva', `/cuentas/${id}`])('denies non-ADMIN grants on %s', async (path) => {
  const mock = mount(path, undefined, { ...session, role: 'ENLACE' });
  await screen.findByText(/No tienes permiso para esta sección de cuentas/);
  expect(mock.mock.calls.filter(([url]) => url !== '/api/auth/me')).toHaveLength(0);
});
it.each([
  ['users:update', true, false],
  ['users:change-status', false, true],
  ['', false, false],
] as const)(
  'shows only the specifically granted account action (%s)',
  async (grant, edit, status) => {
    mount(`/cuentas/${id}`, undefined, { ...session, permissions: ['users:read', grant] });
    await screen.findByRole('heading', { name: `Cuenta: ${account.username}` });
    expect(!!screen.queryByLabelText('Nuevo nombre completo')).toBe(edit);
    expect(!!screen.queryByLabelText('Motivo del estado de cuenta')).toBe(status);
  },
);
