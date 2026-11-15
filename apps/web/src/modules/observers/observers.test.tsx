import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from '../../app/App';
import {
  createObserverSchema,
  editObserverSchema,
  statusSchema,
  observerSchema,
  type Observer,
} from './schemas/observers';

const id = '019a7fb0-0000-7000-8000-000000000001';
const observer = {
  id,
  firstNames: 'María José',
  lastNames: 'Álvarez',
  phone: '744 123 4567',
  active: true,
  userId: null as string | null,
  createdAt: '2026-11-14 10:00:00.123456',
  updatedAt: '2026-11-14 10:00:00.123456',
};
const user = {
  id: 'synthetic-admin',
  username: 'admin',
  fullName: 'Persona sintética',
  role: 'ADMIN',
  permissions: [
    'observers:read',
    'observers:create',
    'observers:update',
    'observers:change-status',
  ],
  mustChangePassword: false,
};
const list = { items: [observer], page: 1, pageSize: 20, total: 1 };
type Handler = (path: string, options?: RequestInit) => Response | Promise<Response>;
function mount(
  path: string,
  handler: Handler = (url) => Response.json(url.includes('?') ? list : observer),
  session = user,
) {
  window.history.replaceState(null, '', path);
  const mock = vi.fn<typeof fetch>(async (url, options) =>
    url === '/api/auth/me'
      ? Response.json(session)
      : handler(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, options),
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
const title = `${observer.firstNames} ${observer.lastNames}`;
const detail = () => screen.findByRole('heading', { name: title });
const patches = (mock: ReturnType<typeof mount>) =>
  mock.mock.calls.filter(([, options]) => options?.method === 'PATCH');
function fillCreation() {
  fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: '  María José ' } });
  fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Álvarez' } });
}
function fillEdit() {
  fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Nombres corregidos' } });
  fireEvent.change(screen.getByLabelText('Motivo de edición'), {
    target: { value: 'Corrección sintética' },
  });
}
async function prepareStatus(active = true) {
  await detail();
  fireEvent.change(screen.getByLabelText('Motivo del cambio de estado'), {
    target: { value: 'Estado autorizado' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: active ? 'Revisar desactivación' : 'Revisar activación' }),
  );
  await screen.findByRole('heading', {
    name: active ? 'Confirmar desactivación' : 'Confirmar activación',
  });
}

it('lists real profile fields and preserves URL filters when returning from detail', async () => {
  mount('/observadores?active=true');
  await screen.findByRole('rowheader', { name: observer.firstNames });
  expect(screen.getByRole('cell', { name: observer.phone })).toBeTruthy();
  expect(screen.getByRole('cell', { name: 'Activo' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: `Ver detalle de ${title}` }));
  await detail();
  expect(screen.getAllByText(observer.createdAt, { selector: 'time' })).toHaveLength(2);
  expect(
    screen.getAllByText(observer.createdAt, { selector: 'time' })[0].getAttribute('datetime'),
  ).toBe('2026-11-14T10:00:00.123456Z');
  expect(screen.getByText('Sin cuenta vinculada')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Volver a observadores' }));
  await screen.findByRole('rowheader');
  expect(window.location.search).toBe('?active=true');
});
it('validates the real MySQL UTC response contract without losing microseconds', () => {
  expect(observerSchema.parse(observer)).toEqual(observer);
  expect(observerSchema.safeParse({ ...observer, createdAt: 'not a timestamp' }).success).toBe(
    false,
  );
  expect(
    observerSchema.safeParse({ ...observer, updatedAt: '2026-11-14T10:00:00.123456Z' }).success,
  ).toBe(false);
});

it.each(['edit', 'status'])(
  'distinguishes failed %s preflight from an uncertain write',
  async (operation) => {
    let failRead = false;
    const mock = mount(`/observadores/${id}`, () => {
      if (failRead) {
        failRead = false;
        throw new TypeError('Failed to fetch');
      }
      return Response.json(observer);
    });
    await detail();
    if (operation === 'edit') fillEdit();
    else await prepareStatus();
    failRead = true;
    fireEvent.click(
      screen.getByRole('button', {
        name: operation === 'edit' ? 'Guardar cambios' : 'Confirmar cambio de estado',
      }),
    );
    await screen.findByText(/No se envió ningún cambio/);
    expect(patches(mock)).toHaveLength(0);
    expect(screen.queryByText(/la operación podría haberse aplicado/)).toBeNull();
  },
);

it('refreshes committed edits after a lost response without claiming mutation success or resending', async () => {
  let current: Observer = { ...observer };
  const mock = mount(`/observadores/${id}`, (_url, options) => {
    if (options?.method === 'PATCH') {
      current = { ...current, firstNames: 'Nombres corregidos' };
      throw new TypeError('Lost committed response');
    }
    return Response.json(current);
  });
  await detail();
  fillEdit();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText(/No se confirmó el resultado/);
  await screen.findByRole('heading', { name: `Nombres corregidos ${observer.lastNames}` });
  expect(patches(mock)).toHaveLength(1);
  expect(screen.queryByText(/Edición confirmada/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cargar datos actuales' }));
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  expect((screen.getByLabelText('Motivo de edición') as HTMLInputElement).value).toBe('');
});
it('shows a linked account only as server-provided metadata, never linking or provisioning controls', async () => {
  const userId = '019a7fb0-0000-7000-8000-000000000002';
  mount(`/observadores/${id}`, () => Response.json({ ...observer, userId }), {
    ...user,
    permissions: [...user.permissions, 'observers:link-account', 'users:create'],
  });
  await detail();
  expect(screen.getByText(userId)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /vincular|cuenta|asignación/i })).toBeNull();
});
it('filters by literal name search, active and linked, resets page and paginates', async () => {
  const mock = mount('/observadores?page=2&pageSize=1&context=keep', (url) => {
    const params = new URL(url, window.location.origin).searchParams;
    return Response.json({
      ...list,
      page: Number(params.get('page')),
      pageSize: Number(params.get('pageSize')),
      total: 3,
    });
  });
  await screen.findByText('Página 2 de 3 · 3 registros');
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 3 de 3 · 3 registros');
  fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  await screen.findByText('Página 2 de 3 · 3 registros');
  fireEvent.change(screen.getByLabelText('Buscar por nombres o apellidos'), {
    target: { value: '%Nombre_' },
  });
  await screen.findByText('Página 1 de 3 · 3 registros');
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'false' } });
  fireEvent.change(screen.getByLabelText('Vinculación de cuenta'), { target: { value: 'true' } });
  await waitFor(() =>
    expect(
      mock.mock.calls.some(
        ([url]) =>
          typeof url === 'string' && url.includes('search=%25Nombre_&active=false&linked=true'),
      ),
    ).toBe(true),
  );
  expect(window.location.search).toContain('context=keep');
  fireEvent.change(screen.getByLabelText('Registros por página'), { target: { value: '2' } });
  await screen.findByText('Página 1 de 2 · 3 registros');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  await waitFor(() => expect(window.location.search).not.toMatch(/search=|active=|linked=/));
});
it.each([
  'page=0&pageSize=101&active=invalid&linked=bad',
  'page=1000001&pageSize=0',
  'page=2bad&pageSize=-1',
])('bounds unsupported URL values %s', async (search) => {
  const mock = mount(`/observadores?${search}`);
  await screen.findByRole('rowheader');
  expect(mock.mock.calls.some(([url]) => url === '/api/observers?page=1&pageSize=20')).toBe(true);
});
it('rejects overlong searches before calling the API', async () => {
  const mock = mount(`/observadores?search=${'a'.repeat(201)}`);
  await screen.findByRole('alert');
  expect(mock.mock.calls).toHaveLength(1);
});
it.each(['/observadores', `/observadores/${id}`])(
  'shows loading, error, retry and empty/detail on %s',
  async (path) => {
    let respond: Handler = () => new Promise(() => {});
    mount(path, (url, options) => respond(url, options));
    await screen.findByText(
      path === '/observadores' ? 'Cargando observadores…' : 'Cargando detalle del observador…',
    );
    cleanup();
    respond = () => new Response(null, { status: 503 });
    render(<App />);
    await screen.findByRole('alert');
    respond = () =>
      Response.json(path === '/observadores' ? { ...list, items: [], total: 0 } : observer);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    if (path === '/observadores')
      await screen.findByText('No hay observadores en esta página para los filtros seleccionados.');
    else await detail();
  },
);
it.each(['/observadores', '/observadores/nuevo', '/OBSERVADORES/NUEVO/', `/observadores/${id}`])(
  'never grants an ADMIN permission bypass on %s',
  async (path) => {
    const mock = mount(path, undefined, { ...user, permissions: [] });
    await screen.findByText('No tienes permiso para esta sección de observadores.');
    expect(mock.mock.calls).toHaveLength(1);
  },
);
it.each(['observers:read', 'observers:update', 'observers:change-status'])(
  'requires each operation-specific permission: %s',
  async (permission) => {
    mount('/', undefined, { ...user, role: 'ENLACE', permissions: ['observers:read', permission] });
    fireEvent.click(await screen.findByRole('link', { name: 'Observadores' }));
    fireEvent.click(await screen.findByRole('link', { name: `Ver detalle de ${title}` }));
    await detail();
    expect(screen.queryByRole('link', { name: 'Crear observador' })).toBeNull();
    expect(Boolean(screen.queryByRole('heading', { name: 'Editar observador' }))).toBe(
      permission === 'observers:update',
    );
    expect(Boolean(screen.queryByRole('heading', { name: 'Estado del perfil' }))).toBe(
      permission === 'observers:change-status',
    );
  },
);
it.each([400, 403, 404])('handles server read rejection HTTP %s', async (status) => {
  mount(`/observadores/${id}`, () => new Response(null, { status }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
});
it('rejects malformed identifiers without making a detail request', async () => {
  const mock = mount('/observadores/not-a-uuid');
  await screen.findByText('El identificador del observador no es válido.');
  expect(mock.mock.calls).toHaveLength(1);
});
it('matches Unicode limits, preserves spelling/whitespace and accepts empty optional phone only', () => {
  const valid = {
    firstNames: ` ${'😀'.repeat(98)} `,
    lastNames: 'a'.repeat(100),
    phone: '😀'.repeat(20),
  };
  expect(createObserverSchema.parse(valid)).toEqual(valid);
  expect(createObserverSchema.parse({ ...valid, phone: '' }).phone).toBe('');
  for (const input of [
    { ...valid, firstNames: '' },
    { ...valid, firstNames: '   ' },
    { ...valid, firstNames: '😀'.repeat(101) },
    { ...valid, lastNames: 'a'.repeat(101) },
    { ...valid, phone: ' ' },
    { ...valid, phone: '😀'.repeat(21) },
  ])
    expect(createObserverSchema.safeParse(input).success).toBe(false);
  for (const reason of ['', '   ', '😀'.repeat(501)]) {
    expect(editObserverSchema.safeParse({ ...valid, reason }).success).toBe(false);
    expect(statusSchema.safeParse({ reason }).success).toBe(false);
  }
});
it('validates creation, sends only profile fields with CSRF and invalidates cached lists', async () => {
  const mock = mount('/observadores', (url) => Response.json(url.includes('?') ? list : observer));
  await screen.findByRole('rowheader');
  fireEvent.click(screen.getByRole('link', { name: 'Crear observador' }));
  await screen.findByRole('heading', { name: 'Crear observador' });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar observador' }));
  await screen.findByText('Escribe los nombres.');
  await screen.findByText('Escribe los apellidos.');
  expect(mock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar observador' }));
  await detail();
  const post = mock.mock.calls.find(([, options]) => options?.method === 'POST')![1]!;
  expect(JSON.parse(post.body as string)).toEqual({
    firstNames: '  María José ',
    lastNames: 'Álvarez',
    phone: null,
  });
  expect(new Headers(post.headers).get('X-HHP-CSRF')).toBe('1');
  expect(post.credentials).toBe('same-origin');
  fireEvent.click(screen.getByRole('link', { name: 'Volver a observadores' }));
  await waitFor(() =>
    expect(
      mock.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.startsWith('/api/observers?'),
      ),
    ).toHaveLength(2),
  );
});
it('creates without read permission using the authorized home navigation', async () => {
  mount('/', () => Response.json(observer), { ...user, permissions: ['observers:create'] });
  fireEvent.click(await screen.findByRole('link', { name: 'Crear observador' }));
  await screen.findByRole('heading', { name: 'Crear observador' });
  fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar observador' }));
  await screen.findByText('Perfil creado y activo, confirmado por el servidor.');
  expect(window.location.pathname).toBe('/observadores/nuevo');
});
it.each([400, 403, 409, 503, 'network', 'malformed'])(
  'preserves creation data and handles rejected/uncertain %s without retries',
  async (status) => {
    const mock = mount('/observadores/nuevo', () => {
      if (status === 'network') throw new TypeError('Failed to fetch');
      if (status === 'malformed') return Response.json({ ...observer, active: false });
      return new Response('unsafe raw detail', { status: Number(status) });
    });
    await screen.findByRole('heading', { name: 'Crear observador' });
    fillCreation();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar observador' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Nombres') as HTMLInputElement).value).toBe('  María José ');
    expect(screen.queryByText('unsafe raw detail')).toBeNull();
    expect(mock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(
      (screen.getByRole('button', { name: 'Guardar observador' }) as HTMLButtonElement).disabled,
    ).toBe([503, 'network', 'malformed'].includes(status));
  },
);
it('does not submit no-op edits and requires a reason', async () => {
  const mock = mount(`/observadores/${id}`);
  await detail();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText('Escribe el motivo administrativo.');
  fireEvent.change(screen.getByLabelText('Motivo de edición'), {
    target: { value: 'Motivo sintético' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText('No hay cambios que guardar.');
  expect(patches(mock)).toHaveLength(0);
});
it('edits changed fields, clears phone with null and refreshes confirmed detail/list data', async () => {
  let current: Observer = { ...observer };
  const mock = mount('/observadores', (url, options) => {
    if (options?.method === 'PATCH') {
      current = {
        ...current,
        firstNames: 'Nombres corregidos',
        phone: null,
        updatedAt: '2026-11-14 10:01:00.123456',
      };
      return new Response(null, { status: 204 });
    }
    return Response.json(url.includes('?') ? { ...list, items: [current] } : current);
  });
  await screen.findByRole('rowheader');
  fireEvent.click(screen.getByRole('link', { name: `Ver detalle de ${title}` }));
  await detail();
  fillEdit();
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByRole('heading', { name: `Nombres corregidos ${observer.lastNames}` });
  expect(JSON.parse(patches(mock)[0][1]!.body as string)).toEqual({
    firstNames: 'Nombres corregidos',
    phone: null,
    reason: 'Corrección sintética',
  });
  expect(screen.getByText('Sin teléfono')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Volver a observadores' }));
  await screen.findByRole('rowheader', { name: 'Nombres corregidos' });
});
it('rejects stale edits, preserves inputs and requires an explicit fresh reload', async () => {
  let current = { ...observer };
  const mock = mount(`/observadores/${id}`, () => Response.json(current));
  await detail();
  fillEdit();
  current = { ...current, lastNames: 'Apellidos actuales' };
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText(/El perfil cambió/);
  expect(patches(mock)).toHaveLength(0);
  expect((screen.getByLabelText('Nombres') as HTMLInputElement).value).toBe('Nombres corregidos');
  current = { ...current, phone: '123 actual' };
  fireEvent.click(screen.getByRole('button', { name: 'Cargar datos actuales' }));
  await waitFor(() =>
    expect((screen.getByLabelText('Teléfono (opcional)') as HTMLInputElement).value).toBe(
      '123 actual',
    ),
  );
  expect((screen.getByLabelText('Apellidos') as HTMLInputElement).value).toBe('Apellidos actuales');
});
it.each([400, 403, 409, 503, 'network'])(
  'preserves edit inputs on %s and blocks resubmission until fresh reload',
  async (status) => {
    const mock = mount(`/observadores/${id}`, (_url, options) => {
      if (options?.method !== 'PATCH') return Response.json(observer);
      if (status === 'network') throw new TypeError('Failed to fetch');
      return new Response(null, { status: Number(status) });
    });
    await detail();
    fillEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Nombres') as HTMLInputElement).value).toBe('Nombres corregidos');
    expect(
      (screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(patches(mock)).toHaveLength(1);
    expect(screen.queryByText(/Edición confirmada/)).toBeNull();
  },
);
it.each([true, false])(
  'confirms %s -> inverse only with a reason, fresh reads and explicit confirmation',
  async (active) => {
    let current = { ...observer, active };
    const mock = mount('/observadores', (url, options) => {
      if (options?.method === 'PATCH') {
        current = { ...current, active: !active };
        return new Response(null, { status: 204 });
      }
      return Response.json(url.includes('?') ? { ...list, items: [current] } : current);
    });
    await screen.findByRole('rowheader');
    fireEvent.click(screen.getByRole('link', { name: `Ver detalle de ${title}` }));
    await detail();
    fireEvent.click(
      screen.getByRole('button', { name: active ? 'Revisar desactivación' : 'Revisar activación' }),
    );
    await screen.findByText('Escribe el motivo administrativo.');
    await prepareStatus(active);
    expect(patches(mock)).toHaveLength(0);
    expect(
      screen.getByText(/No cambia el estado de la cuenta, sus sesiones ni las asignaciones/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await prepareStatus(active);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de estado' }));
    await screen.findByText('Cambio de estado confirmado por el servidor.');
    await screen.findByText(active ? 'Inactivo' : 'Activo');
    expect(patches(mock)[0][0]).toBe(`/api/observers/${id}/status`);
    expect(JSON.parse(patches(mock)[0][1]!.body as string)).toEqual({
      active: !active,
      reason: 'Estado autorizado',
    });
    fireEvent.click(screen.getByRole('link', { name: 'Volver a observadores' }));
    await screen.findByRole('cell', { name: active ? 'Inactivo' : 'Activo' });
  },
);
it.each(['before-review', 'after-review'])(
  'detects stale status %s without silently reversing it',
  async (when) => {
    let current = { ...observer };
    const mock = mount(`/observadores/${id}`, () => Response.json(current));
    if (when === 'after-review') await prepareStatus();
    else {
      await detail();
      fireEvent.change(screen.getByLabelText('Motivo del cambio de estado'), {
        target: { value: 'Motivo sintético' },
      });
    }
    current = { ...current, active: false };
    fireEvent.click(
      screen.getByRole('button', {
        name: when === 'after-review' ? 'Confirmar cambio de estado' : 'Revisar desactivación',
      }),
    );
    await screen.findByText(/El perfil cambió/);
    expect(patches(mock)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Confirmar cambio de estado' })).toBeNull();
  },
);
it.each([400, 403, 409, 503, 'network'])(
  'handles status rejection/uncertainty %s without optimism or write retries',
  async (status) => {
    const mock = mount(`/observadores/${id}`, (_url, options) => {
      if (options?.method !== 'PATCH') return Response.json(observer);
      if (status === 'network') throw new TypeError('Failed to fetch');
      return new Response(null, { status: Number(status) });
    });
    await prepareStatus();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de estado' }));
    await screen.findByRole('alert');
    await screen.findByRole('button', { name: 'Revisar desactivación' });
    expect(screen.getByText('Activo')).toBeTruthy();
    expect(patches(mock)).toHaveLength(1);
    expect(screen.queryByText('Cambio de estado confirmado por el servidor.')).toBeNull();
  },
);
