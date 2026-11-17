import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from '../../app/App';
import { activationSchema, createOperativeSchema } from './schemas/operatives';

const id = '019a7fb0-0000-7000-8000-000000000001';
const operative = {
  id,
  name: 'Invierno Guerrero',
  startDate: '2027-01-01',
  endDate: '2027-01-31',
  status: 'borrador',
  arrivalToleranceMinutes: null,
  createdAt: '2026-11-14T10:00:00.123456Z',
  updatedAt: '2026-11-14T10:00:00.123456Z',
};
const admin = {
  id: 'synthetic-admin',
  username: 'admin',
  fullName: 'Persona sintética',
  role: 'ADMIN',
  permissions: ['operatives:read', 'operatives:create', 'operatives:activate'],
  mustChangePassword: false,
};
const list = { items: [operative], page: 1, limit: 20, total: 1 };
type Handler = (path: string, options?: RequestInit) => Response | Promise<Response>;
function mount(
  path: string,
  handler: Handler = (url) => Response.json(url.includes('?') ? list : operative),
  user = admin,
) {
  window.history.replaceState(null, '', path);
  const fetchMock = vi.fn<typeof fetch>(async (url, options) =>
    url === '/api/auth/me'
      ? Response.json(user)
      : handler(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, options),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  return fetchMock;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

it('lists actual names, dates and states and selects URL-based administrative context', async () => {
  mount('/operativos?status=borrador');
  await screen.findByRole('rowheader', { name: operative.name }, { timeout: 5000 });
  const tableRegion = screen.getByRole('region', { name: 'Tabla de operativos' });
  expect(tableRegion.tabIndex).toBe(0);
  expect(tableRegion.contains(screen.getByRole('table', { name: 'Operativos de Guerrero' }))).toBe(
    true,
  );
  expect(screen.getByText('2027-01-01')).toBeTruthy();
  expect(screen.getByText('2027-01-31')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: `Ver detalle de ${operative.name}` }));
  await screen.findByRole('heading', { name: operative.name });
  expect(window.location.pathname).toBe(`/operativos/${id}`);
  expect(screen.getByText('Contexto administrativo seleccionado')).toBeTruthy();
  expect(screen.getByText('Sin configurar')).toBeTruthy();
  expect(screen.getAllByText(operative.createdAt, { selector: 'time' })).toHaveLength(2);
  fireEvent.click(screen.getByRole('link', { name: 'Volver a operativos' }));
  await screen.findByRole('rowheader', { name: operative.name });
  expect(window.location.search).toContain('status=borrador');
});

it('shares supported filters, resets pagination and uses only server ordering', async () => {
  const mock = mount('/operativos?page=2&limit=1&context=keep', (url) => {
    const params = new URL(url, window.location.origin).searchParams;
    return Response.json({
      ...list,
      total: 3,
      page: Number(params.get('page')),
      limit: Number(params.get('limit')),
    });
  });
  await screen.findByText('Página 2 de 3 · 3 registros');
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 3 de 3 · 3 registros');
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '%Invierno_' } });
  await screen.findByText('Página 1 de 3 · 3 registros');
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'activo' } });
  await waitFor(() =>
    expect(
      mock.mock.calls.some(
        ([url]) => typeof url === 'string' && url.includes('name=%25Invierno_&status=activo'),
      ),
    ).toBe(true),
  );
  expect(window.location.search).toContain('context=keep');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  await waitFor(() => expect(window.location.search).not.toMatch(/name=|status=/));
});

it.each(['page=0&limit=101&status=invalid', 'page=9007199254740991&limit=0', 'page=2bad&limit=-1'])(
  'bounds malformed URL filters %s',
  async (search) => {
    const mock = mount(`/operativos?${search}`);
    await screen.findByRole('rowheader', { name: operative.name });
    expect(mock.mock.calls.some(([url]) => url === '/api/operatives?page=1&limit=20')).toBe(true);
  },
);

it.each(['/operativos', `/operativos/${id}`])(
  'shows loading, error and explicit retry on %s',
  async (path) => {
    let response: () => Promise<Response> = () => new Promise(() => {});
    const mock = mount(path, () => response());
    await screen.findByText(
      path === '/operativos' ? 'Cargando operativos…' : 'Cargando detalle del operativo…',
    );
    // Resolve a new request by re-rendering through a fresh test mount below.
    cleanup();
    response = async () => new Response(null, { status: 503 });
    render(<App />);
    await screen.findByRole('alert');
    response = async () =>
      Response.json(path === '/operativos' ? { ...list, items: [], total: 0 } : operative);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    if (path === '/operativos')
      await screen.findByText('No hay operativos en esta página para los filtros seleccionados.');
    else await screen.findByRole('heading', { name: operative.name });
    expect(mock.mock.calls.length).toBeGreaterThan(3);
  },
);

it.each([
  ['/operativos', []],
  ['/operativos/nuevo', ['operatives:read']],
  ['/operativos/nuevo/', ['operatives:read']],
  ['/OPERATIVOS/NUEVO', ['operatives:read']],
  [`/operativos/${id}`, []],
])('does not bypass permissions for ADMIN on %s', async (path, permissions) => {
  const mock = mount(path, undefined, { ...admin, permissions });
  await screen.findByText('No tienes permiso para esta sección de operativos.');
  expect(mock.mock.calls.every(([url]) => url === '/api/auth/me')).toBe(true);
});

it('shows navigation and activation only for actual permissions, independent of role names', async () => {
  mount('/', undefined, { ...admin, role: 'ENLACE', permissions: ['operatives:read'] });
  fireEvent.click(await screen.findByRole('link', { name: 'Operativos' }));
  fireEvent.click(await screen.findByRole('link', { name: `Ver detalle de ${operative.name}` }));
  await screen.findByRole('heading', { name: operative.name });
  expect(screen.queryByRole('link', { name: 'Crear operativo' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Activación administrativa' })).toBeNull();
});

it('keeps observer administrative navigation outside the approved role matrix', async () => {
  mount('/', undefined, { ...admin, role: 'OBSERVADOR' });
  await screen.findByRole('heading', { name: 'Inicio' });
  expect(screen.queryByRole('link', { name: 'Operativos' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Crear operativo' })).toBeNull();
});

it('confirms creation without navigating to an unauthorized detail when read is not granted', async () => {
  mount('/operativos/nuevo', () => Response.json(operative), {
    ...admin,
    permissions: ['operatives:create'],
  });
  await screen.findByRole('heading', { name: 'Crear operativo' });
  fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  await screen.findByText('Operativo creado en borrador.');
  expect(window.location.pathname).toBe('/operativos/nuevo');
  expect(screen.queryByRole('link', { name: 'Consultar operativos' })).toBeNull();
});

it.each([
  { ...operative, name: '   ' },
  { ...operative, name: 'a'.repeat(121) },
  { ...operative, startDate: '2027-02-30' },
  { ...operative, startDate: '0999-12-31' },
  { ...operative, startDate: '2028-01-01' },
])('validates actual creation contract without sending invalid values', (input) => {
  expect(createOperativeSchema.safeParse(input).success).toBe(false);
});
it('trims names and accepts exact Unicode and leap-day boundaries', () => {
  expect(
    createOperativeSchema.parse({
      name: `  ${'😀'.repeat(120)}  `,
      startDate: '2028-02-29',
      endDate: '2028-02-29',
    }).name,
  ).toBe('😀'.repeat(120));
});

function fillCreation() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Invierno Guerrero  ' } });
  fireEvent.change(screen.getByLabelText('Fecha inicial'), {
    target: { value: operative.startDate },
  });
  fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: operative.endDate } });
}
it('validates creation fields, creates only a draft and invalidates the previously cached list', async () => {
  const mock = mount('/operativos', (url, options) =>
    Response.json(options?.method === 'POST' || !url.includes('?') ? operative : list),
  );
  await screen.findByRole('rowheader', { name: operative.name });
  fireEvent.click(screen.getByRole('link', { name: 'Crear operativo' }));
  await screen.findByRole('heading', { name: 'Crear operativo' });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  await screen.findByText('Escribe el nombre.');
  expect(mock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  await screen.findByRole('heading', { name: operative.name });
  const post = mock.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(post![1]!.body as string)).toEqual({
    name: operative.name,
    startDate: operative.startDate,
    endDate: operative.endDate,
  });
  fireEvent.click(screen.getByRole('link', { name: 'Volver a operativos' }));
  await waitFor(() =>
    expect(
      mock.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.startsWith('/api/operatives?'),
      ).length,
    ).toBe(2),
  );
});

it.each([400, 409, 503])(
  'preserves form data and displays controlled creation HTTP %s errors',
  async (status) => {
    mount('/operativos/nuevo', () => new Response(null, { status }));
    await screen.findByRole('heading', { name: 'Crear operativo' });
    fillCreation();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toContain(operative.name);
    expect(screen.queryByText('Operativo creado en borrador.')).toBeNull();
  },
);

async function prepareActivation() {
  await screen.findByRole('heading', { name: operative.name });
  fireEvent.change(screen.getByLabelText('Tolerancia de llegada (minutos)'), {
    target: { value: '0' },
  });
  fireEvent.change(screen.getByLabelText('Motivo administrativo'), {
    target: { value: 'Inicio autorizado' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar activación' }));
  await screen.findByRole('heading', { name: 'Confirmar activación' });
}

it.each([
  { reason: '', arrivalToleranceMinutes: 0 },
  { reason: '   ', arrivalToleranceMinutes: 15 },
  { reason: '😀'.repeat(501), arrivalToleranceMinutes: 15 },
  { reason: 'OK', arrivalToleranceMinutes: -1 },
  { reason: 'OK', arrivalToleranceMinutes: 1.5 },
  { reason: 'OK', arrivalToleranceMinutes: 65536 },
  { reason: 'OK' },
])('requires explicit integer tolerance and administrative reason', (input) => {
  expect(activationSchema.safeParse(input).success).toBe(false);
});

it('requires form validation, rereads state before confirmation and submission, and invalidates after success', async () => {
  let current = { ...operative };
  const mock = mount(`/operativos/${id}`, (url, options) => {
    if (options?.method === 'POST') {
      current = { ...current, status: 'activo' };
      return new Response(null, { status: 204 });
    }
    return Response.json(url.includes('?') ? { ...list, items: [current] } : current);
  });
  await screen.findByRole('heading', { name: operative.name });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar activación' }));
  await screen.findByText('Escribe el motivo administrativo.');
  expect(mock.mock.calls.length).toBe(2);
  await prepareActivation();
  expect(mock.mock.calls.filter(([url]) => url === `/api/operatives/${id}`).length).toBe(2);
  expect(mock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  await prepareActivation();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar activación' }));
  await screen.findByText('Activación confirmada por el servidor.');
  await screen.findByText('Activo');
  expect(mock.mock.calls.filter(([url]) => url === `/api/operatives/${id}`).length).toBe(5);
  const post = mock.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(post![1]!.body as string)).toEqual({
    arrivalToleranceMinutes: 0,
    reason: 'Inicio autorizado',
  });
  expect(screen.queryByRole('button', { name: 'Revisar activación' })).toBeNull();
});

it('does not POST if another administrator changes state after confirmation', async () => {
  let current = { ...operative };
  const mock = mount(`/operativos/${id}`, () => Response.json(current));
  await prepareActivation();
  current = { ...current, status: 'activo' };
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar activación' }));
  await screen.findByText(/El operativo cambió/);
  expect(mock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  expect(screen.queryByText('Activación confirmada por el servidor.')).toBeNull();
});

it.each([409, 400, 403, 503])(
  'handles invalid/expired/conflicting activation HTTP %s without optimism or automatic retries',
  async (status) => {
    const mock = mount(`/operativos/${id}`, (_url, options) =>
      options?.method === 'POST' ? new Response(null, { status }) : Response.json(operative),
    );
    await prepareActivation();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar activación' }));
    await screen.findByRole('alert');
    await screen.findByRole('button', { name: 'Revisar activación' });
    expect(screen.getByText('Borrador')).toBeTruthy();
    expect(mock.mock.calls.filter(([, options]) => options?.method === 'POST').length).toBe(1);
    expect(screen.queryByRole('button', { name: 'Confirmar activación' })).toBeNull();
  },
);

it.each(['activo', 'cerrado'])(
  'never offers unsupported transitions or tolerance editing for %s',
  async (status) => {
    mount(`/operativos/${id}`, () =>
      Response.json({ ...operative, status, arrivalToleranceMinutes: 15 }),
    );
    await screen.findByRole('heading', { name: operative.name });
    expect(screen.queryByRole('button', { name: 'Revisar activación' })).toBeNull();
    expect(screen.queryByLabelText('Tolerancia de llegada (minutos)')).toBeNull();
  },
);
