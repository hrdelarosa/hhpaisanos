import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { QueryClient } from '@tanstack/react-query';
import { App } from '../../app/App';
import { assignmentSchema, createAssignmentSchema, filterSchema } from './schemas/assignments';
import { assignmentStatus } from './utils/feedback';

const id = '019a7fb0-0000-7000-8000-000000000001';
const observerId = '019a7fb0-0000-7000-8000-000000000002';
const operativeId = '019a7fb0-0000-7000-8000-000000000003';
const attentionModuleId = '019a7fb0-0000-7000-8000-000000000004';
const replacementId = '019a7fb0-0000-7000-8000-000000000005';
const timestamp = '2026-11-15T10:00:00.123456Z';
const assignment = {
  id,
  observerId,
  operativeId,
  attentionModuleId,
  validFrom: '2026-01-01',
  validTo: '2099-12-31',
  startTime: '08:00:00',
  endTime: '16:00:00',
  cancelledAt: null,
  version: 7,
  createdBy: id,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const observer = {
  id: observerId,
  firstNames: 'Persona',
  lastNames: 'Sintética',
  active: true,
  phone: null,
  userId: null,
  createdAt: '2026-11-15 10:00:00.123456',
  updatedAt: '2026-11-15 10:00:00.123456',
};
const operative = {
  id: operativeId,
  name: 'Operativo sintético',
  status: 'activo',
  startDate: '2026-01-01',
  endDate: '2099-12-31',
  arrivalToleranceMinutes: 10,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const module = {
  id: attentionModuleId,
  name: 'Módulo sintético',
  municipality: 'Acapulco',
  active: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const user = {
  id: 'synthetic-admin',
  username: 'admin',
  fullName: 'Administración sintética',
  role: 'ADMIN',
  mustChangePassword: false,
  permissions: [
    'assignments:read',
    'assignments:create',
    'assignments:update',
    'assignments:cancel',
    'observers:read',
    'operatives:read',
    'attention-modules:read',
  ],
};
type Handler = (path: string, options?: RequestInit) => Response | Promise<Response> | undefined;
const requestPath = (url: RequestInfo | URL) =>
  typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
function requestBody(options: RequestInit | undefined): unknown {
  if (typeof options?.body !== 'string') throw new Error('Expected a JSON string body');
  return JSON.parse(options.body);
}
function mount(path: string, handler: Handler = () => undefined, session = user) {
  window.history.replaceState(null, '', path);
  const mock = vi.fn<typeof fetch>(async (url, options) => {
    const path = requestPath(url);
    const result = await handler(path, options);
    if (result) return result;
    if (path === '/api/auth/me') return Response.json(session);
    if (path.startsWith('/api/assignments?'))
      return Response.json({ items: [assignment], total: 1, page: 1, limit: 20 });
    if (path.startsWith('/api/observers?'))
      return Response.json({ items: [observer], total: 1, page: 1, pageSize: 20 });
    if (path.startsWith('/api/operatives?'))
      return Response.json({ items: [operative], total: 1, page: 1, limit: 20 });
    if (path.startsWith('/api/attention-modules?'))
      return Response.json({ items: [module], total: 1, page: 1, limit: 20 });
    if (path === `/api/observers/${observerId}`) return Response.json(observer);
    if (path === `/api/operatives/${operativeId}`) return Response.json(operative);
    if (path === `/api/attention-modules/${attentionModuleId}`) return Response.json(module);
    if (path === '/api/auth/logout') return new Response(null, { status: 204 });
    return Response.json(assignment);
  });
  vi.stubGlobal('fetch', mock);
  render(<App />);
  return mock;
}
const writes = (mock: ReturnType<typeof mount>) =>
  mock.mock.calls.filter(
    ([url, options]) =>
      requestPath(url).startsWith('/api/assignments') && options?.method === 'POST',
  );
const detail = () => screen.findByRole('heading', { name: 'Detalle de asignación' });

it('focuses the unresolved resource search and does not move focus again when options arrive', async () => {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  mount('/asignaciones/nueva', (path) =>
    path.startsWith('/api/observers?') ? pending : undefined,
  );
  const search = await screen.findByLabelText('Buscar observador');
  fireEvent.click(screen.getByRole('button', { name: 'Revisar creación' }));
  await waitFor(() => expect(document.activeElement).toBe(search));
  expect(search.getAttribute('aria-invalid')).toBe('true');
  const date = screen.getByLabelText('Inicio de vigencia');
  date.focus();
  finish(Response.json({ items: [observer], total: 1, page: 1, pageSize: 20 }));
  const select = await screen.findByLabelText('Seleccionar observador (página 1)');
  expect(select.getAttribute('aria-invalid')).toBe('true');
  expect(search.getAttribute('aria-invalid')).toBe('false');
  expect(document.activeElement).toBe(date);
});

it('focuses invalid creation selectors in displayed order before dates and times', async () => {
  const mock = mount('/asignaciones/nueva');
  await screen.findByLabelText('Seleccionar observador (página 1)');
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Revisar creación' }));
  for (const [label, value] of [
    ['Seleccionar observador (página 1)', observerId],
    ['Seleccionar operativo (página 1)', operativeId],
    ['Seleccionar módulo de atención (página 1)', attentionModuleId],
    ['Inicio de vigencia', '2026-11-16'],
    ['Fin de vigencia', '2026-11-17'],
    ['Hora de entrada', '09:00:00'],
    ['Hora de salida', '17:00:00'],
  ]) {
    submit();
    const control = screen.getByLabelText(label);
    await waitFor(() => expect(document.activeElement).toBe(control));
    expect(control.getAttribute('aria-invalid')).toBe('true');
    const errorId = control.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)?.textContent).toBeTruthy();
    expect(document.getElementById(errorId!)?.getAttribute('role')).not.toBe('alert');
    change(label, value);
    await waitFor(() => expect(control.getAttribute('aria-invalid')).toBe('false'));
    expect(control.getAttribute('aria-describedby')).toBeNull();
  }
  submit();
  await screen.findByRole('heading', { name: 'Confirmar creación' });
  expect(writes(mock)).toHaveLength(0);
  expect(document.title).toBe('Crear asignación | Heroínas y Héroes Paisanos');
});
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function prepare(operation = 'change') {
  await detail();
  change('Operación', operation);
  if (operation === 'change') {
    change('Cambio efectivo desde', '2099-01-01');
    change('Nueva hora de entrada', '09:00:00');
  }
  if (operation === 'terminate') change('Último día válido', '2099-01-01');
  change('Motivo administrativo', 'Decisión sintética autorizada');
  fireEvent.click(screen.getByRole('button', { name: 'Revisar operación' }));
  await screen.findByRole('region', { name: 'Confirmación de operación' });
}
async function fillCreation() {
  await screen.findByRole('heading', { name: 'Crear asignación' });
  await screen.findByRole('option', { name: new RegExp('Persona Sintética') });
  change('Seleccionar observador (página 1)', observerId);
  change('Seleccionar operativo (página 1)', operativeId);
  change('Seleccionar módulo de atención (página 1)', attentionModuleId);
  change('Inicio de vigencia', '2099-01-01');
  change('Fin de vigencia', '2099-02-01');
  change('Hora de entrada', '08:00');
  change('Hora de salida', '16:00');
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

it('lists real contracts, detail timestamps and preserved URL filters', async () => {
  const mock = mount(`/asignaciones?observerId=${observerId}&cancelled=false`);
  fireEvent.click(await screen.findByRole('link', { name: `Ver asignación ${id}` }));
  await detail();
  expect(screen.getAllByText(timestamp, { selector: 'time' })).toHaveLength(2);
  expect(screen.getByText(/Una fecha final no distingue/)).toBeTruthy();
  expect(
    screen
      .getByRole('link', { name: 'Consultar todos los períodos del observador' })
      .getAttribute('href'),
  ).toBe(`/asignaciones?observerId=${observerId}`);
  fireEvent.click(screen.getByRole('link', { name: 'Volver a asignaciones' }));
  await screen.findByRole('heading', { name: 'Asignaciones' });
  expect(window.location.search).toBe(`?observerId=${observerId}&cancelled=false`);
  expect(
    mock.mock.calls.some(([url]) => requestPath(url).includes(`observerId=${observerId}`)),
  ).toBe(true);
});
it('sends all supported filters, pagination and no invented status filter', async () => {
  const mock = mount(
    `/asignaciones?observerId=${observerId}&operativeId=${operativeId}&attentionModuleId=${attentionModuleId}&applicableOn=2026-11-15&from=2026-01-01&to=2099-12-31&cancelled=false&page=2&limit=10`,
  );
  await screen.findByRole('link', { name: `Ver asignación ${id}` });
  const url = requestPath(
    mock.mock.calls.find(([url]) => requestPath(url).startsWith('/api/assignments?'))![0],
  );
  const params = new URL(url, 'http://localhost').searchParams;
  expect(Object.fromEntries(params)).toEqual({
    observerId,
    operativeId,
    attentionModuleId,
    applicableOn: '2026-11-15',
    from: '2026-01-01',
    to: '2099-12-31',
    cancelled: 'false',
    page: '2',
    limit: '10',
  });
  change('Identificador del módulo', '');
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('page')).toBeNull());
});
it.each([
  'observerId=no',
  'from=2026-02-30',
  'from=2099-01-01&to=2026-01-01',
  'limit=101',
  'page=-1',
  'cancelled=unknown',
])('rejects invalid filters before issuing reads: %s', async (params) => {
  const mock = mount(`/asignaciones?${params}`);
  await screen.findByText(/Filtros inválidos/);
  expect(mock.mock.calls.some(([url]) => requestPath(url).startsWith('/api/assignments'))).toBe(
    false,
  );
});
it('distinguishes scheduled, elapsed and cancelled periods without inventing a server status', () => {
  expect(assignmentStatus({ ...assignment, validTo: '2026-01-02' })).toBe(
    'Finalizada por vigencia',
  );
  expect(assignmentStatus({ ...assignment, validFrom: '2099-01-01' })).toBe('Programada');
  expect(assignmentStatus({ ...assignment, cancelledAt: timestamp })).toBe('Cancelada');
  expect(assignmentStatus(assignment)).toBe('Vigente por fechas');
});
it.each(['list', 'detail'])('shows %s loading, error and manual read retry', async (view) => {
  let resolve!: (response: Response) => void;
  const mock = mount(view === 'list' ? '/asignaciones' : `/asignaciones/${id}`, (path) => {
    if (path.startsWith('/api/assignments'))
      return new Promise<Response>((r) => {
        resolve = r;
      });
  });
  await screen.findByText(view === 'list' ? 'Cargando asignaciones.' : 'Cargando asignación.');
  resolve(new Response(null, { status: 403 }));
  await screen.findByText('No tienes permiso para esta operación o lectura.');
  const count = mock.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(mock.mock.calls.length).toBeGreaterThan(count));
});
it('renders empty list and locally scroll-free mobile list structure', async () => {
  mount('/asignaciones', (path) =>
    path.startsWith('/api/assignments?')
      ? Response.json({ items: [], total: 0, page: 1, limit: 20 })
      : undefined,
  );
  await screen.findByText('No hay asignaciones para esta página y filtros.');
  expect(screen.getByRole('button', { name: 'Anterior' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Siguiente' }).hasAttribute('disabled')).toBe(true);
});
it('creates only after review and fresh resource checks, using the exact CSRF payload', async () => {
  const mock = mount('/asignaciones/nueva');
  await fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Revisar creación' }));
  await screen.findByRole('region', { name: 'Confirmación de creación' });
  expect(writes(mock)).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar creación' }));
  await screen.findByText('Creación confirmada por el servidor.');
  const [, options] = writes(mock)[0];
  expect(requestBody(options)).toEqual({
    observerId,
    operativeId,
    attentionModuleId,
    validFrom: '2099-01-01',
    validTo: '2099-02-01',
    startTime: '08:00:00',
    endTime: '16:00:00',
  });
  expect(new Headers(options?.headers).get('X-HHP-CSRF')).toBe('1');
  expect(options?.credentials).toBe('same-origin');
  expect(writes(mock)).toHaveLength(1);
});
it.each(['observer', 'module', 'operative', 'dates'])(
  'prevents creation with ineligible %s after selection',
  async (kind) => {
    let changed = false;
    const mock = mount('/asignaciones/nueva', (path) => {
      if (!changed) return;
      if (kind === 'observer' && path === `/api/observers/${observerId}`)
        return Response.json({ ...observer, active: false });
      if (kind === 'module' && path === `/api/attention-modules/${attentionModuleId}`)
        return Response.json({ ...module, active: false });
      if ((kind === 'operative' || kind === 'dates') && path === `/api/operatives/${operativeId}`)
        return Response.json({
          ...operative,
          ...(kind === 'dates' ? { endDate: '2027-01-01' } : { status: 'cerrado' }),
        });
    });
    await fillCreation();
    changed = true;
    fireEvent.click(screen.getByRole('button', { name: 'Revisar creación' }));
    await screen.findByText(/Observador o módulo inactivo/);
    expect(writes(mock)).toHaveLength(0);
  },
);
it('blocks a creation whose selected resource changed after review', async () => {
  let changed = false;
  const mock = mount('/asignaciones/nueva', (path) =>
    changed && path === `/api/attention-modules/${attentionModuleId}`
      ? Response.json({ ...module, name: 'Nombre concurrente' })
      : undefined,
  );
  await fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Revisar creación' }));
  await screen.findByRole('region', { name: 'Confirmación de creación' });
  changed = true;
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar creación' }));
  await screen.findByText(/El estado cambió/);
  expect(writes(mock)).toHaveLength(0);
});
it.each(['change', 'terminate', 'cancel'] as const)(
  'confirms %s with expectedVersion and only supported fields',
  async (operation) => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const mock = mount(`/asignaciones/${id}`, (path, options) => {
      if (options?.method === 'POST')
        return operation === 'change'
          ? Response.json({
              ...assignment,
              id: replacementId,
              version: 1,
              validFrom: '2099-01-01',
              startTime: '09:00:00',
            })
          : new Response(null, { status: 204 });
    });
    await prepare(operation);
    expect(writes(mock)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }));
    await screen.findByText(/Operación confirmada por el servidor/);
    expect(writes(mock)).toHaveLength(1);
    const [path, options] = writes(mock)[0];
    expect(path).toBe(`/api/assignments/${id}/${operation}`);
    expect(requestBody(options)).toEqual({
      expectedVersion: 7,
      reason: 'Decisión sintética autorizada',
      ...(operation === 'change'
        ? { effectiveFrom: '2099-01-01', startTime: '09:00:00' }
        : operation === 'terminate'
          ? { lastValidDate: '2099-01-01' }
          : {}),
    });
    if (operation === 'change')
      expect(
        screen
          .getByRole('link', { name: `Consultar nuevo período ${replacementId}` })
          .getAttribute('href'),
      ).toBe(`/asignaciones/${replacementId}`);
    expect(invalidate.mock.calls.some(([filter]) => filter?.queryKey?.[0] === 'assignments')).toBe(
      true,
    );
    expect(invalidate.mock.calls.some(([filter]) => filter?.queryKey?.[0] === 'attendance')).toBe(
      true,
    );
    expect(screen.getByText(/2026-01-01 — 2099-12-31/)).toBeTruthy(); // No optimistic rewrite of historical period.
  },
);
it.each(['change', 'terminate', 'cancel'])('requires a reason for %s', async (operation) => {
  const mock = mount(`/asignaciones/${id}`);
  await detail();
  change('Operación', operation);
  fireEvent.click(screen.getByRole('button', { name: 'Revisar operación' }));
  await screen.findByText('Escribe el motivo administrativo.');
  expect(writes(mock)).toHaveLength(0);
});
it('requires an actual condition and effective date and supports backing out of confirmation', async () => {
  const mock = mount(`/asignaciones/${id}`);
  await detail();
  change('Motivo administrativo', 'Motivo');
  fireEvent.click(screen.getByRole('button', { name: 'Revisar operación' }));
  await screen.findByText('Escribe la fecha efectiva.');
  expect(screen.getByText('Selecciona al menos una condición nueva.')).toBeTruthy();
  await prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Volver sin aplicar' }));
  expect(writes(mock)).toHaveLength(0);
});
it.each([400, 403, 404, 409])(
  'handles authoritative %s without retrying a mutation',
  async (status) => {
    const mock = mount(`/asignaciones/${id}`, (_path, options) =>
      options?.method === 'POST' ? new Response(null, { status }) : undefined,
    );
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }));
    await screen.findByRole('button', { name: 'Consultar estado antes de otra intención' });
    expect(writes(mock)).toHaveLength(1);
    expect(screen.queryByText(/Operación confirmada por el servidor/)).toBeNull();
  },
);
it.each(['network', '500', 'malformed'])(
  'blocks automatic resubmission after uncertain %s response',
  async (failure) => {
    const mock = mount(`/asignaciones/${id}`, (_path, options) => {
      if (options?.method !== 'POST') return;
      if (failure === 'network') throw new TypeError('lost response');
      return failure === '500'
        ? new Response(null, { status: 500 })
        : Response.json({ unexpected: true });
    });
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }));
    await screen.findByText(/Resultado incierto/);
    expect(screen.queryByRole('button', { name: 'Confirmar operación' })).toBeNull();
    expect(writes(mock)).toHaveLength(1);
  },
);
it('distinguishes failed final preflight from an uncertain write', async () => {
  let fail = false;
  const mock = mount(`/asignaciones/${id}`, (path) => {
    if (fail && path === `/api/assignments/${id}`) throw new TypeError('offline');
  });
  await prepare();
  fail = true;
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }));
  await screen.findByText(/No se pudo revalidar el estado/);
  expect(writes(mock)).toHaveLength(0);
});
it('rejects stale version at final preflight and requires refresh and reconfirmation', async () => {
  let changed = false;
  const mock = mount(`/asignaciones/${id}`, (path) =>
    changed && path === `/api/assignments/${id}`
      ? Response.json({ ...assignment, version: 8, validTo: '2099-06-01' })
      : undefined,
  );
  await prepare();
  changed = true;
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }));
  await screen.findByText(/El estado cambió/);
  expect(writes(mock)).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar estado antes de otra intención' }));
  await screen.findByRole('button', { name: 'Revisar operación' });
  expect(screen.queryByRole('button', { name: 'Confirmar operación' })).toBeNull();
});
it('keeps cancellation authoritative and exposes no reactivation or historical overwrite', async () => {
  mount(`/asignaciones/${id}`, (path) =>
    path === `/api/assignments/${id}`
      ? Response.json({ ...assignment, cancelledAt: timestamp })
      : undefined,
  );
  await detail();
  expect(screen.getByText(/Asignación cancelada: se conserva/)).toBeTruthy();
  expect(screen.queryByLabelText('Operación')).toBeNull();
});
it.each(['/asignaciones', '/asignaciones/nueva', `/asignaciones/${id}`])(
  'has no ADMIN permission bypass on %s',
  async (path) => {
    const mock = mount(path, undefined, { ...user, permissions: [] });
    await screen.findByText('No tienes permiso para esta sección de asignaciones.');
    expect(mock.mock.calls.some(([url]) => requestPath(url).startsWith('/api/assignments'))).toBe(
      false,
    );
  },
);
it.each(['assignments:update', 'assignments:cancel'])(
  'gates actions individually without requiring ADMIN: %s',
  async (permission) => {
    mount(`/asignaciones/${id}`, undefined, {
      ...user,
      role: 'ENLACE',
      permissions: ['assignments:read', 'operatives:read', permission],
    });
    await detail();
    expect(Boolean(screen.queryByRole('option', { name: 'Cancelar asignación' }))).toBe(
      permission === 'assignments:cancel',
    );
    expect(Boolean(screen.queryByRole('option', { name: 'Finalizar asignación' }))).toBe(
      permission === 'assignments:update',
    );
  },
);
it('does not read unauthorized resource catalogs or offer creation without required reads', async () => {
  const mock = mount('/asignaciones/nueva', undefined, {
    ...user,
    permissions: ['assignments:create'],
  });
  await screen.findByText(/Crear una asignación requiere lecturas autorizadas/);
  expect(mock.mock.calls.filter(([url]) => requestPath(url) !== '/api/auth/me')).toHaveLength(0);
});
it('renders read-only assignment details without unauthorized resource reads', async () => {
  const mock = mount(`/asignaciones/${id}`, undefined, {
    ...user,
    permissions: ['assignments:read'],
  });
  await detail();
  expect(screen.queryByLabelText('Operación')).toBeNull();
  expect(
    mock.mock.calls.every(
      ([url]) =>
        requestPath(url).startsWith('/api/auth/') ||
        requestPath(url).startsWith('/api/assignments/'),
    ),
  ).toBe(true);
});
it('isolates a late assignment result from the signed-out session', async () => {
  let resolve!: (response: Response) => void;
  let signedOut = false;
  const mock = mount(`/asignaciones/${id}`, (path, options) => {
    if (path === '/api/auth/logout') {
      signedOut = true;
      return new Response(null, { status: 204 });
    }
    if (path === '/api/auth/me' && signedOut) return new Response(null, { status: 401 });
    if (path.startsWith('/api/assignments/') && options?.method === 'POST')
      return new Promise<Response>((r) => {
        resolve = r;
      });
  });
  await prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }));
  await waitFor(() => expect(writes(mock)).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  resolve(Response.json({ ...assignment, id: replacementId }));
  await waitFor(() => expect(screen.queryByText(/Operación confirmada/)).toBeNull());
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});
it('validates intervals, version limits and microseconds at the API boundary', () => {
  expect(assignmentSchema.parse(assignment).createdAt).toBe(timestamp);
  expect(assignmentSchema.safeParse({ ...assignment, version: 4294967296 }).success).toBe(false);
  expect(
    createAssignmentSchema.safeParse({
      ...assignment,
      validFrom: '2099-01-01',
      validTo: '2026-01-01',
    }).success,
  ).toBe(false);
  expect(
    createAssignmentSchema.safeParse({ ...assignment, startTime: '22:00:00', endTime: '06:00:00' })
      .success,
  ).toBe(false);
  expect(
    filterSchema.safeParse({
      observerId: '',
      operativeId: '',
      attentionModuleId: '',
      applicableOn: '',
      from: '',
      to: '',
      cancelled: '',
      page: Number.MAX_SAFE_INTEGER,
      limit: 100,
    }).success,
  ).toBe(false);
});

it('preserves dynamically changed nuqs filters in the actual detail link', async () => {
  mount('/asignaciones');
  await screen.findByRole('link', { name: `Ver asignación ${id}` });
  change('Identificador del observador', observerId);
  await waitFor(() =>
    expect(
      screen.getByRole('link', { name: `Ver asignación ${id}` }).getAttribute('href'),
    ).toContain(`observerId=${observerId}`),
  );
  fireEvent.click(screen.getByRole('link', { name: `Ver asignación ${id}` }));
  await detail();
  expect(
    screen.getByRole('link', { name: 'Volver a asignaciones' }).getAttribute('href'),
  ).toContain(`observerId=${observerId}`);
});
it.each(['conflict', 'uncertain'])(
  'keeps creation %s authoritative and never resubmits',
  async (failure) => {
    const mock = mount('/asignaciones/nueva', (path, options) => {
      if (path !== '/api/assignments' || options?.method !== 'POST') return;
      if (failure === 'uncertain') throw new TypeError('response lost');
      return new Response(null, { status: 409 });
    });
    await fillCreation();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar creación' }));
    await screen.findByRole('region', { name: 'Confirmación de creación' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar creación' }));
    await screen.findByText(
      failure === 'uncertain' ? /Resultado incierto/ : /Conflicto: versión desactualizada/,
    );
    expect(writes(mock)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Confirmar creación' })).toBeNull();
    expect(screen.queryByText('Creación confirmada por el servidor.')).toBeNull();
  },
);
it('accepts a server-confirmed 204 no-op change without inventing a replacement', async () => {
  const mock = mount(`/asignaciones/${id}`, (_path, options) =>
    options?.method === 'POST' ? new Response(null, { status: 204 }) : undefined,
  );
  await prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }));
  await screen.findByText(/una operación sin cambios/);
  expect(screen.queryByRole('link', { name: /Consultar nuevo período/ })).toBeNull();
  expect(writes(mock)).toHaveLength(1);
});
it('blocks duplicate confirmations while a write is pending', async () => {
  let finish!: (response: Response) => void;
  const mock = mount(`/asignaciones/${id}`, (_path, options) =>
    options?.method === 'POST'
      ? new Promise<Response>((resolve) => {
          finish = resolve;
        })
      : undefined,
  );
  await prepare();
  const button = screen.getByRole('button', { name: 'Confirmar operación' });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(writes(mock)).toHaveLength(1));
  expect(button.hasAttribute('disabled')).toBe(true);
  finish(new Response(null, { status: 204 }));
  await screen.findByText(/Operación confirmada por el servidor/);
  expect(writes(mock)).toHaveLength(1);
});
it('uses existing paginated read contracts for picker search without losing selection', async () => {
  const mock = mount('/asignaciones/nueva', (path) =>
    path.startsWith('/api/observers?')
      ? Response.json({ items: [observer], total: 21, page: 1, pageSize: 20 })
      : undefined,
  );
  await fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de observador' }));
  await screen.findByLabelText('Seleccionar observador (página 2)');
  expect(screen.getAllByText(/Selección:/).length).toBeGreaterThan(0);
  change('Buscar observador', 'Persona');
  await screen.findByLabelText('Seleccionar observador (página 1)');
  await waitFor(() =>
    expect(mock.mock.calls.some(([url]) => requestPath(url).includes('search=Persona'))).toBe(true),
  );
});
it('handles creation resource preflight denial without sending a write', async () => {
  let deny = false;
  const mock = mount('/asignaciones/nueva', (path) =>
    deny && path === `/api/observers/${observerId}`
      ? new Response(null, { status: 403 })
      : undefined,
  );
  await fillCreation();
  deny = true;
  fireEvent.click(screen.getByRole('button', { name: 'Revisar creación' }));
  await screen.findByText('No tienes permiso para esta operación o lectura.');
  expect(writes(mock)).toHaveLength(0);
});
