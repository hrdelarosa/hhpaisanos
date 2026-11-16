import {
  act,
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from '../../app/App';
import {
  administrativeDetailSchema,
  administrativeHistorySchema,
  administrativeListSchema,
  reviewInputSchema,
} from './schemas/administration';

configure({ asyncUtilTimeout: 5000 });

const id = '019a7000-0000-7000-8000-000000000001';
const assignmentId = '019a7000-0000-7000-8000-000000000002';
const actorId = '019a7000-0000-7000-8000-000000000003';
const user = {
  id: actorId,
  username: 'synthetic',
  fullName: 'Persona sintética',
  role: 'ADMIN',
  permissions: ['attendance:read', 'attendance:review'],
  mustChangePassword: false,
};
const record = {
  id,
  assignmentId,
  observerId: actorId,
  operativeId: assignmentId,
  moduleId: assignmentId,
  observerName: 'Observadora sintética',
  operativeName: 'Operativo sintético',
  moduleName: 'Módulo sintético',
  date: '2026-11-14',
  type: 'entrada',
  version: 2,
  current: true,
  officialTimestamp: '2026-11-14T15:30:00.123456Z',
  originalEventTimestamp: '2026-11-14T15:20:00.654321Z',
  reviewStatus: 'pending_review',
  policyVersion: 'personal-v1',
  channel: 'web',
  startTime: '09:00:00',
  endTime: '17:00:00',
  completeness: 'check_in_only',
  anomalies: ['late_arrival'],
  locationEvidence: {
    status: 'provided_unverified',
    latitude: 16.123456,
    longitude: -99.123456,
    accuracy: 3,
  },
  predecessorId: null,
  captureActorId: actorId,
  manualReason: null,
  correctionReason: 'Ajuste sintético',
  decision: { actorId: null, timestamp: null, reason: null },
};
const page = (items: unknown[], total = items.length, pageNumber = 1) => ({
  items,
  total,
  page: pageNumber,
  limit: 20,
});
type Handler = (path: string, init?: RequestInit) => Response | Promise<Response>;
const requestPath = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
function mount(path = '/asistencias', handler?: Handler, session = user) {
  window.history.replaceState(null, '', path);
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = requestPath(input);
    if (path === '/api/auth/me') return Response.json(session);
    if (handler) return handler(path, init);
    if (path.includes('/history')) return Response.json(page([{ ...record, events: [] }]));
    if (path.startsWith('/api/attendance?')) return Response.json(page([record]));
    return Response.json(record);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  return fetchMock;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});
async function confirm(decision = 'accept') {
  await screen.findByLabelText('Motivo de revisión');
  fireEvent.change(screen.getByLabelText('Decisión'), { target: { value: decision } });
  fireEvent.change(screen.getByLabelText('Motivo de revisión'), {
    target: { value: 'Motivo sintético' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar decisión' }));
  await screen.findByRole('button', { name: 'Confirmar decisión' });
}

it('lists confirmed records without precise evidence and retains newly changed URL filters on return', async () => {
  const fetchMock = mount();
  await screen.findByText('Captura: Solo entrada registrada');
  expect(document.body.textContent).not.toMatch(/16\.123456|-99\.123456|Ausente/);
  fireEvent.change(screen.getByLabelText('Estado de revisión'), {
    target: { value: 'pending_review' },
  });
  await waitFor(() =>
    expect(screen.getByRole('link', { name: /Ver detalle/ }).getAttribute('href')).toContain(
      'reviewStatus=pending_review',
    ),
  );
  fireEvent.click(screen.getByRole('link', { name: /Ver detalle/ }));
  await screen.findByText('16.123456');
  expect(screen.getByRole('link', { name: 'Volver a asistencias' }).getAttribute('href')).toContain(
    'reviewStatus=pending_review',
  );
  expect(fetchMock.mock.calls.every(([url]) => !requestPath(url).includes('receipt'))).toBe(true);
});

it('sends only supported filters and paginates server-side', async () => {
  const fetchMock = mount(
    `/asistencias?operativeId=${id}&observerId=${actorId}&moduleId=${assignmentId}&from=2026-11-01&to=2026-11-14&reviewStatus=pending_review&anomaly=late_arrival&limit=1`,
    (path) =>
      Response.json(
        page(
          [record],
          21,
          new URL(path, 'http://localhost').searchParams.get('page') === '2' ? 2 : 1,
        ),
      ),
  );
  await screen.findByText('Captura: Solo entrada registrada');
  const url = requestPath(
    fetchMock.mock.calls.find(([url]) => requestPath(url).startsWith('/api/attendance?'))![0],
  );
  for (const value of [
    'operativeId=',
    'observerId=',
    'moduleId=',
    'from=2026-11-01',
    'to=2026-11-14',
    'reviewStatus=pending_review',
    'anomaly=late_arrival',
    'limit=1',
  ])
    expect(url).toContain(value);
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([url]) => requestPath(url).includes('page=2'))).toBe(true),
  );
});

it.each([
  'from=2026-11-15&to=2026-11-01',
  'observerId=invalid',
  'limit=101',
  'page=0',
  'reviewStatus=absent',
])('blocks invalid filters %s', async (search) => {
  const fetchMock = mount(`/asistencias?${search}`);
  await screen.findByText(/Filtros inválidos/);
  expect(fetchMock.mock.calls.some(([url]) => requestPath(url).startsWith('/api/attendance'))).toBe(
    false,
  );
});

it('renders original capture, subsequent versions and exposed review events without fabricated evidence', async () => {
  mount(`/asistencias/${id}`, (path) =>
    Response.json(
      path.includes('/history')
        ? page([
            {
              ...record,
              version: 1,
              current: false,
              reviewStatus: 'rejected',
              events: [
                {
                  action: 'attendance.reviewed',
                  actorId,
                  timestamp: record.officialTimestamp,
                  reason: 'Decisión histórica',
                  previousStatus: 'pending_review',
                  reviewStatus: 'rejected',
                },
              ],
            },
            { ...record, id: assignmentId, events: [] },
          ])
        : record,
    ),
  );
  await screen.findByText('Versión 1 · Captura original');
  expect(screen.getByText('Versión 2 · Versión posterior')).toBeTruthy();
  expect(screen.getByText('Motivo: Decisión histórica')).toBeTruthy();
  expect(
    screen.getByText(`Hora del evento original (UTC): ${record.originalEventTimestamp}`),
  ).toBeTruthy();
  expect(
    screen.getByText('Sin evidencia de decisión administrativa en este detalle.'),
  ).toBeTruthy();
  expect(screen.getByText('Esta evidencia no prueba presencia física.')).toBeTruthy();
  expect(screen.getByText('16.123456')).toBeTruthy();
});

it.each(['accept', 'reject'])(
  'reviews %s with reason, expectedVersion, fresh reads, CSRF and no optimistic decisions',
  async (decision) => {
    let current = { ...record };
    let reads = 0;
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const fetchMock = mount(`/asistencias/${id}`, (path, init) => {
      if (init?.method === 'POST') {
        current = {
          ...current,
          reviewStatus: decision === 'accept' ? 'accepted_administrative' : 'rejected',
        };
        return Response.json({ id, version: 2, reviewStatus: current.reviewStatus });
      }
      if (path.includes('/history')) return Response.json(page([{ ...current, events: [] }]));
      reads++;
      return Response.json(current);
    });
    await confirm(decision);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisión' }));
    await screen.findByText(/Decisión confirmada por el servidor/);
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(1);
    const body = posts[0][1]?.body;
    expect(JSON.parse(typeof body === 'string' ? body : '')).toEqual({
      decision,
      reason: 'Motivo sintético',
      expectedVersion: 2,
    });
    expect(new Headers(posts[0][1]?.headers).get('X-HHP-CSRF')).toBe('1');
    expect(posts[0][1]?.credentials).toBe('same-origin');
    expect(reads).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('Llegada tardía').length).toBeGreaterThan(0);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['attendance'] });
  },
);

it('requires a nonblank Unicode-bounded reason and explicit confirmation', async () => {
  mount(`/asistencias/${id}`);
  await screen.findByLabelText('Motivo de revisión');
  fireEvent.click(screen.getByRole('button', { name: 'Revisar decisión' }));
  await screen.findByText('Escribe un motivo no vacío de hasta 500 caracteres.');
  expect(screen.queryByRole('button', { name: 'Confirmar decisión' })).toBeNull();
  expect(
    reviewInputSchema.safeParse({ decision: 'accept', reason: '😀'.repeat(500) }).success,
  ).toBe(true);
  expect(
    reviewInputSchema.safeParse({ decision: 'accept', reason: '😀'.repeat(501) }).success,
  ).toBe(false);
});

it.each([
  { ...record, version: 3 },
  { ...record, current: false },
  { ...record, reviewStatus: 'accepted_administrative' },
])('blocks changed or competing-reviewed records before submission', async (changed) => {
  let current = record;
  const fetchMock = mount(`/asistencias/${id}`, (path) =>
    Response.json(path.includes('/history') ? page([]) : current),
  );
  await confirm();
  current = changed;
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisión' }));
  await screen.findByText(/El registro cambió o ya fue revisado/);
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});

it.each([400, 403, 404, 409, 500, 'network', 'malformed'])(
  'handles %s without automatically retrying writes, and invalidates queries',
  async (failure) => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const fetchMock = mount(`/asistencias/${id}`, (path, init) => {
      if (init?.method === 'POST') {
        if (failure === 'network') throw new TypeError('offline');
        if (failure === 'malformed') return Response.json({ unexpected: 'value' });
        return new Response('{}', { status: Number(failure) });
      }
      return Response.json(path.includes('/history') ? page([]) : record);
    });
    await confirm();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisión' }));
    await screen.findByRole('button', { name: 'Consultar estado antes de otra intención' });
    const text =
      failure === 409
        ? /Conflicto: versión desactualizada/
        : failure === 403
          ? /No tienes permiso para esta operación/
          : failure === 404
            ? /El registro no está disponible/
            : failure === 400
              ? /El servidor rechazó los datos/
              : /Resultado incierto/;
    expect(screen.getByText(text)).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(screen.queryByText(/Decisión confirmada por el servidor/)).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['attendance'] });
  },
);

it.each(['accepted_automatic', 'accepted_administrative', 'rejected', 'annulled'])(
  'does not review records in %s',
  async (reviewStatus) => {
    mount(`/asistencias/${id}`, (path) =>
      Response.json(path.includes('/history') ? page([]) : { ...record, reviewStatus }),
    );
    await screen.findByText(/Este registro no admite revisión/);
    expect(screen.queryByLabelText('Motivo de revisión')).toBeNull();
  },
);

it.each([
  { ...user, permissions: [] },
  { ...user, role: 'OBSERVADOR' },
])('enforces role and permission on direct routes, including ADMIN', async (session) => {
  const fetchMock = mount(`/asistencias/${id}`, undefined, session);
  await screen.findByText('No tienes permiso para consultar asistencias administrativas.');
  expect(fetchMock.mock.calls.some(([url]) => requestPath(url).startsWith('/api/attendance'))).toBe(
    false,
  );
  expect(document.body.textContent).not.toContain('16.123456');
});

it('supports read-only review history without unauthorized catalog or assignment reads', async () => {
  const fetchMock = mount(`/asistencias/${id}`, undefined, {
    ...user,
    role: 'ENLACE',
    permissions: ['attendance:read'],
  });
  await screen.findByText('16.123456');
  expect(screen.queryByLabelText('Motivo de revisión')).toBeNull();
  expect(screen.queryByRole('link', { name: assignmentId })).toBeNull();
  expect(
    fetchMock.mock.calls.every(
      ([url]) => requestPath(url).startsWith('/api/attendance') || url === '/api/auth/me',
    ),
  ).toBe(true);
});

it.each(['/asistencias', `/asistencias/${id}`])(
  'shows loading, read errors and manual retry at %s',
  async (path) => {
    let resolve!: (r: Response) => void;
    let pending = true;
    mount(path, () =>
      pending
        ? new Promise<Response>((r) => {
            resolve = r;
          })
        : Response.json(path === '/asistencias' ? page([]) : record),
    );
    await screen.findByText(
      path === '/asistencias' ? 'Cargando asistencias.' : 'Cargando detalle de asistencia.',
    );
    pending = false;
    resolve(new Response('{}', { status: 403 }));
    await screen.findByText('No tienes permiso para esta operación o lectura.');
    fireEvent.click(
      screen.getByRole('button', {
        name: path === '/asistencias' ? 'Reintentar' : 'Reintentar detalle',
      }),
    );
    await screen.findByText(
      path === '/asistencias'
        ? 'No hay registros para esta página y filtros. Esto no implica ausencia.'
        : '16.123456',
    );
  },
);

it('strips GPS from list/history projections and only accepts it in detail', () => {
  expect(JSON.stringify(administrativeListSchema.parse(page([record])))).not.toMatch(
    /16\.123456|latitude|longitude/,
  );
  expect(
    JSON.stringify(administrativeHistorySchema.parse(page([{ ...record, events: [] }]))),
  ).not.toMatch(/16\.123456|latitude/);
  expect(administrativeDetailSchema.parse(record).locationEvidence).toMatchObject({
    latitude: 16.123456,
  });
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});

it('shows permission-aware navigation', async () => {
  mount('/');
  expect(
    (await screen.findByRole('link', { name: 'Asistencias administrativas' })).getAttribute('href'),
  ).toBe('/asistencias');
});

it('locks duplicate decisions and never shows an optimistic success', async () => {
  let settle!: (response: Response) => void;
  const fetchMock = mount(`/asistencias/${id}`, (path, init) => {
    if (init?.method === 'POST')
      return new Promise<Response>((resolve) => {
        settle = resolve;
      });
    return Response.json(path.includes('/history') ? page([]) : record);
  });
  await confirm();
  const button = screen.getByRole('button', { name: 'Confirmar decisión' });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() =>
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1),
  );
  expect(screen.queryByText(/Decisión confirmada/)).toBeNull();
  settle(Response.json({ id, version: 2, reviewStatus: 'accepted_administrative' }));
  await screen.findByText(/Decisión confirmada por el servidor/);
});

it('keeps uncertainty after an explicit authoritative read', async () => {
  let current = record;
  const fetchMock = mount(`/asistencias/${id}`, (path, init) => {
    if (init?.method === 'POST') {
      current = { ...record, reviewStatus: 'accepted_administrative' };
      throw new TypeError('lost response');
    }
    return Response.json(path.includes('/history') ? page([]) : current);
  });
  await confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisión' }));
  await screen.findByText(/Resultado incierto/);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar estado antes de otra intención' }));
  await screen.findByText(/Este registro no admite revisión/);
  expect(screen.getByText(/Resultado incierto/)).toBeTruthy();
  expect(screen.queryByText(/Decisión confirmada por el servidor/)).toBeNull();
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});

it('isolates a late review settlement from the signed-out session', async () => {
  let settle!: (response: Response) => void;
  const fetchMock = mount(`/asistencias/${id}`, (path, init) => {
    if (path === '/api/auth/logout') return new Response(null, { status: 204 });
    if (init?.method === 'POST')
      return new Promise<Response>((resolve) => {
        settle = resolve;
      });
    return Response.json(path.includes('/history') ? page([]) : record);
  });
  await confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisión' }));
  await waitFor(() => expect(settle).toBeTypeOf('function'));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('button', { name: 'Iniciar sesión' });
  settle(Response.json({ id, version: 2, reviewStatus: 'accepted_administrative' }));
  await waitFor(() => expect(screen.queryByText('16.123456')).toBeNull());
  expect(screen.queryByText(/Decisión confirmada/)).toBeNull();
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2);
});

it('renders missing GPS and paginated history errors without inventing evidence', async () => {
  const fetchMock = mount(`/asistencias/${id}?historyPage=2`, (path) =>
    path.includes('/history')
      ? new Response('{}', { status: 500 })
      : Response.json({ ...record, locationEvidence: { status: 'missing', reason: 'timeout' } }),
  );
  await screen.findByText('Sin ubicación. Motivo reportado: timeout');
  await screen.findByRole('button', { name: 'Reintentar historial' });
  expect(
    fetchMock.mock.calls.some(([url]) => requestPath(url).includes('/history?page=2&limit=20')),
  ).toBe(true);
  expect(screen.queryByText('Latitud')).toBeNull();
});

it('does not start a read or write after session disposal during final preflight', async () => {
  const fetchMock = mount(`/asistencias/${id}`, (path) =>
    path === '/api/auth/logout'
      ? new Response(null, { status: 204 })
      : Response.json(path.includes('/history') ? page([]) : record),
  );
  await confirm();
  let release!: () => void;
  vi.spyOn(QueryClient.prototype, 'cancelQueries').mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar decisión' }));
  await waitFor(() => expect(release).toBeTypeOf('function'));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('button', { name: 'Iniciar sesión' });
  const count = fetchMock.mock.calls.length;
  await act(async () => release());
  await waitFor(() => expect(screen.queryByText('16.123456')).toBeNull());
  expect(fetchMock.mock.calls).toHaveLength(count);
  expect(
    fetchMock.mock.calls.some(
      ([url, init]) => requestPath(url).endsWith('/review') && init?.method === 'POST',
    ),
  ).toBe(false);
});
