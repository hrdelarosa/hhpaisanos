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
import { manualInputSchema, officialTimestampSchema } from './schemas/historical';

configure({ asyncUtilTimeout: 5000 });
const id = '019a7000-0000-7000-8000-000000000001';
const assignmentId = '019a7000-0000-7000-8000-000000000002';
const nextId = '019a7000-0000-7000-8000-000000000003';
const timestamp = '2026-11-14T15:30:00.123456Z';
const permissions = [
  'attendance:read',
  'attendance:capture-manual',
  'attendance:correct',
  'attendance:annul',
  'attendance:review',
  'assignments:read',
  'observers:read',
  'operatives:read',
];
const user = {
  id,
  username: 'synthetic',
  fullName: 'Persona sintética',
  role: 'ADMIN',
  permissions,
  mustChangePassword: false,
};
const record = {
  id,
  assignmentId,
  observerId: id,
  operativeId: id,
  moduleId: id,
  observerName: 'Observadora sintética',
  operativeName: 'Operativo sintético',
  moduleName: 'Módulo sintético',
  date: '2026-11-14',
  type: 'entrada',
  version: 2,
  current: true,
  officialTimestamp: timestamp,
  originalEventTimestamp: '2026-11-14T15:00:00.654321Z',
  reviewStatus: 'accepted_administrative',
  policyVersion: 'personal-v1',
  channel: 'web',
  startTime: '09:00:00',
  endTime: '17:00:00',
  completeness: 'check_in_only',
  anomalies: [],
  locationEvidence: {
    status: 'provided_unverified',
    latitude: 16.123456,
    longitude: -99.123456,
    accuracy: 3,
  },
  predecessorId: assignmentId,
  captureActorId: id,
  manualReason: null,
  correctionReason: 'Anterior',
  decision: { actorId: id, timestamp, reason: 'Anterior' },
};
const assignment = {
  id: assignmentId,
  observerId: id,
  operativeId: id,
  attentionModuleId: id,
  validFrom: '2026-11-01',
  validTo: '2026-11-30',
  startTime: '09:00:00',
  endTime: '17:00:00',
  cancelledAt: null,
  version: 1,
  createdBy: id,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const operative = {
  id,
  name: 'Operativo sintético',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  status: 'activo',
  arrivalToleranceMinutes: 15,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const manual = {
  observerId: id,
  assignmentId,
  date: '2026-11-14',
  type: 'entrada',
  officialTimestamp: timestamp,
  missingLocationReason: 'position_unavailable',
  reason: 'Motivo sintético',
};
const page = (items: unknown[]) => ({ items, total: items.length, page: 1, limit: 20 });
type Handler = (path: string, init?: RequestInit) => Response | Promise<Response> | undefined;
function mount(path = `/asistencias/${id}`, handler?: Handler, session = user) {
  window.history.replaceState(null, '', path);
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (path === '/api/auth/me') return Response.json(session);
    const override = await handler?.(path, init);
    if (override) return override;
    if (path.includes('/history')) return Response.json(page([{ ...record, events: [] }]));
    if (path.startsWith('/api/attendance?')) return Response.json(page([]));
    if (path.startsWith('/api/assignments?')) return Response.json(page([assignment]));
    if (path.startsWith('/api/assignments/')) return Response.json(assignment);
    if (path.startsWith('/api/observers?'))
      return Response.json({
        items: [
          {
            id,
            firstNames: 'Persona',
            lastNames: 'Sintética',
            phone: null,
            userId: null,
            active: true,
            createdAt: '2026-11-14 15:30:00.123456',
            updatedAt: '2026-11-14 15:30:00.123456',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    if (path.startsWith('/api/observers/'))
      return Response.json({
        id,
        firstNames: 'Persona',
        lastNames: 'Sintética',
        phone: null,
        userId: null,
        active: true,
        createdAt: '2026-11-14 15:30:00.123456',
        updatedAt: '2026-11-14 15:30:00.123456',
      });
    if (path.startsWith('/api/operatives?')) return Response.json(page([operative]));
    if (path.startsWith('/api/operatives/')) return Response.json(operative);
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
});
async function prepare(operation: 'corrección' | 'anulación') {
  fireEvent.change(await screen.findByLabelText(`Motivo de ${operation}`), {
    target: { value: 'Motivo sintético' },
  });
  fireEvent.click(screen.getByRole('button', { name: `Revisar ${operation}` }));
  await screen.findByRole('button', { name: `Confirmar ${operation}` });
}
async function prepareManual(type = 'entrada') {
  fireEvent.change(await screen.findByLabelText(/Seleccionar observador/), {
    target: { value: id },
  });
  fireEvent.change(await screen.findByLabelText(/Seleccionar operativo/), {
    target: { value: id },
  });
  fireEvent.change(await screen.findByLabelText('Asignación histórica'), {
    target: { value: assignmentId },
  });
  fireEvent.change(screen.getByLabelText('Fecha civil de asistencia'), {
    target: { value: manual.date },
  });
  fireEvent.change(screen.getByLabelText('Tipo de marca'), { target: { value: type } });
  fireEvent.change(screen.getByLabelText(/Hora oficial UTC/), { target: { value: timestamp } });
  fireEvent.change(screen.getByLabelText('Motivo de falta de ubicación'), {
    target: { value: manual.missingLocationReason },
  });
  fireEvent.change(screen.getByLabelText('Motivo administrativo de captura'), {
    target: { value: manual.reason },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar captura manual' }));
}

it.each(['entrada', 'salida'])(
  'creates manual %s with exact payload, CSRF and no GPS',
  async (type) => {
    const mock = mount('/asistencias/manual', (path, init) =>
      path === '/api/attendance/manual' && init?.method === 'POST'
        ? Response.json({ id: nextId, version: 1, reviewStatus: 'accepted_administrative' })
        : undefined,
    );
    await prepareManual(type);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar captura manual' }));
    await screen.findByText(/Captura manual confirmada por el servidor/);
    const writes = mock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1]?.body as string)).toEqual({ ...manual, type });
    expect(new Headers(writes[0][1]?.headers).get('X-HHP-CSRF')).toBe('1');
  },
);
it.each(['2026-02-30T15:00:00.000000Z', '2026-11-14T15:00:00.123Z', 'not-a-time'])(
  'rejects invalid official timestamp %s without throwing',
  (officialTimestamp) => {
    expect(officialTimestampSchema.safeParse(officialTimestamp).success).toBe(false);
    expect(manualInputSchema.safeParse({ ...manual, officialTimestamp }).success).toBe(false);
  },
);
it('validates Mexico civil day and required reason without trimming Unicode', () => {
  expect(
    manualInputSchema.safeParse({ ...manual, officialTimestamp: '2026-11-14T01:00:00.000000Z' })
      .success,
  ).toBe(false);
  for (const reason of [' ', '😀'.repeat(501)])
    expect(manualInputSchema.safeParse({ ...manual, reason }).success).toBe(false);
  expect(manualInputSchema.parse({ ...manual, reason: '😀'.repeat(500) }).reason).toHaveLength(
    1000,
  );
});
it.each(['cancelled', 'outside-period', 'wrong-observer', 'draft', 'order', 'existing'])(
  'blocks invalid historical context: %s',
  async (kind) => {
    const mock = mount('/asistencias/manual', (path) => {
      if (path === `/api/assignments/${assignmentId}`)
        return Response.json({
          ...assignment,
          ...(kind === 'cancelled'
            ? { cancelledAt: timestamp }
            : kind === 'outside-period'
              ? { validFrom: '2026-11-15' }
              : kind === 'wrong-observer'
                ? { observerId: nextId }
                : {}),
        });
      if (path === `/api/operatives/${id}` && kind === 'draft')
        return Response.json({ ...operative, status: 'borrador' });
      if (path.startsWith('/api/attendance?') && ['order', 'existing'].includes(kind))
        return Response.json(
          page([
            {
              ...record,
              type: kind === 'order' ? 'salida' : 'entrada',
              officialTimestamp: '2026-11-14T14:00:00.000000Z',
            },
          ]),
        );
      return undefined;
    });
    await prepareManual();
    await screen.findByText(/El registro cambió/);
    expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  },
);
it('corrects only official time with exact expectedVersion and links pending successor without accepting it', async () => {
  const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
  const mock = mount(undefined, (path, init) =>
    path.endsWith('/corrections') && init?.method === 'POST'
      ? Response.json({ id: nextId, version: 3, reviewStatus: 'pending_review' })
      : undefined,
  );
  await prepare('corrección');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar corrección' }));
  await screen.findByText(/Corrección confirmada/);
  expect(screen.getByRole('link', { name: /Consultar nueva versión/ }).getAttribute('href')).toBe(
    `/asistencias/${nextId}`,
  );
  const writes = mock.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toBe(`/api/attendance/${id}/corrections`);
  expect(JSON.parse(writes[0][1]?.body as string)).toEqual({
    officialTimestamp: timestamp,
    reason: manual.reason,
    expectedVersion: 2,
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['attendance'] });
  expect(screen.getByText(record.originalEventTimestamp, { exact: false })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Ver versión anterior/ }).getAttribute('href')).toContain(
    assignmentId,
  );
});
it('annuls without deletion, preserving version and visible history', async () => {
  const mock = mount(undefined, (path, init) =>
    path.endsWith('/annul') && init?.method === 'POST'
      ? Response.json({ id, version: 2, reviewStatus: 'annulled' })
      : undefined,
  );
  await prepare('anulación');
  expect(screen.getByText(/Impide recrear o corregir/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
  await screen.findByText(/Anulación confirmada/);
  const writes = mock.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(JSON.parse(writes[0][1]?.body as string)).toEqual({
    reason: manual.reason,
    expectedVersion: 2,
  });
  expect(screen.getByRole('heading', { name: 'Historial de versiones y decisiones' })).toBeTruthy();
  expect(mock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
});
it.each([400, 403, 409, 500, 0])(
  'settles status %s once and distinguishes rejection/conflict/uncertainty',
  async (status) => {
    let resolve!: (r: Response) => void;
    const mock = mount(undefined, (path, init) =>
      path.endsWith('/annul') && init?.method === 'POST'
        ? new Promise<Response>((r) => {
            resolve = r;
          })
        : undefined,
    );
    await prepare('anulación');
    const button = screen.getByRole('button', { name: 'Confirmar anulación' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(resolve).toBeTypeOf('function'));
    await act(async () =>
      resolve(
        status
          ? Response.json({}, { status })
          : Response.json({ id: nextId, version: 2, reviewStatus: 'annulled' }),
      ),
    );
    await screen.findByText(
      status >= 500 || !status
        ? /Resultado incierto/
        : status === 409
          ? /Conflicto:/
          : status === 403
            ? /No tienes permiso/
            : /El servidor rechazó/,
    );
    expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  },
);
it('detects a competing review between confirmation and final preflight', async () => {
  let changed = false;
  const mock = mount(undefined, (path) =>
    path === `/api/attendance/${id}` && changed
      ? Response.json({ ...record, reviewStatus: 'rejected' })
      : undefined,
  );
  await prepare('corrección');
  changed = true;
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar corrección' }));
  await screen.findByText(/El registro cambió/);
  expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});
it('requires reasons before either operation', async () => {
  const mock = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar corrección' }));
  fireEvent.click(screen.getByRole('button', { name: 'Revisar anulación' }));
  await waitFor(() => expect(screen.getAllByText(/Escribe un motivo no vacío/)).toHaveLength(2));
  expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});
it.each(['correct', 'annul'])(
  'does not bypass missing %s permission for ADMIN',
  async (operation) => {
    mount(undefined, undefined, { ...user, permissions: ['attendance:read'] });
    await screen.findByRole('heading', { name: 'Detalle de asistencia' });
    await screen.findByText('16.123456');
    expect(
      screen.queryByRole('button', {
        name: operation === 'correct' ? 'Revisar corrección' : 'Revisar anulación',
      }),
    ).toBeNull();
  },
);
it('denies direct manual route without operation permission', async () => {
  mount('/asistencias/manual', undefined, { ...user, permissions: ['attendance:read'] });
  await screen.findByText('No tienes permiso para captura manual.');
  expect(screen.queryByRole('button', { name: 'Revisar captura manual' })).toBeNull();
});
it('keeps separate F7 review available for pending corrections', async () => {
  mount(undefined, (path) =>
    path === `/api/attendance/${id}`
      ? Response.json({ ...record, reviewStatus: 'pending_review' })
      : undefined,
  );
  expect(await screen.findByRole('button', { name: 'Revisar decisión' })).toBeTruthy();
});

it.each(['correct', 'annul'])(
  'blocks historical/noncurrent or annulled %s actions',
  async (operation) => {
    mount(undefined, (path) =>
      path === `/api/attendance/${id}`
        ? Response.json({ ...record, current: false, reviewStatus: 'annulled' })
        : undefined,
    );
    await screen.findByText('16.123456');
    expect(
      screen.queryByRole('button', {
        name: operation === 'correct' ? 'Revisar corrección' : 'Revisar anulación',
      }),
    ).toBeNull();
  },
);
it('blocks correction crossing the original civil date', async () => {
  const mock = mount();
  fireEvent.change(await screen.findByLabelText(/Nueva hora oficial UTC/), {
    target: { value: '2026-11-15T15:00:00.000000Z' },
  });
  fireEvent.change(screen.getByLabelText('Motivo de corrección'), {
    target: { value: manual.reason },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar corrección' }));
  await screen.findByText(/La hora debe conservar la fecha civil/);
  expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});
it('does not submit after logout disposes a pending preflight', async () => {
  let hold = false;
  let release!: (value: Response) => void;
  const mock = mount(undefined, (path) => {
    if (path === '/api/auth/logout') return Response.json({});
    if (hold && path === `/api/attendance/${id}`)
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    return undefined;
  });
  await prepare('corrección');
  hold = true;
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar corrección' }));
  await waitFor(() => expect(release).toBeTypeOf('function'));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await act(async () => release(Response.json(record)));
  expect(
    mock.mock.calls.some(
      ([path, init]) => path === `/api/attendance/${id}/corrections` && init?.method === 'POST',
    ),
  ).toBe(false);
});
it('revoked session during write hides administrative evidence and never retries', async () => {
  const mock = mount(undefined, (path, init) =>
    path.endsWith('/annul') && init?.method === 'POST'
      ? Response.json({}, { status: 401 })
      : undefined,
  );
  await prepare('anulación');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  expect(screen.queryByText('16.123456')).toBeNull();
  expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});
it.each(['manual', 'correction'])(
  'keeps malformed %s success uncertain and invalidates personal/admin family',
  async (operation) => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const mock = mount(operation === 'manual' ? '/asistencias/manual' : undefined, (path, init) =>
      init?.method === 'POST' && (path.endsWith('/manual') || path.endsWith('/corrections'))
        ? Response.json({})
        : undefined,
    );
    if (operation === 'manual') await prepareManual();
    else await prepare('corrección');
    fireEvent.click(
      await screen.findByRole('button', {
        name: operation === 'manual' ? 'Confirmar captura manual' : 'Confirmar corrección',
      }),
    );
    await screen.findByText(/Resultado incierto/);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['attendance'] });
    expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  },
);
it('detects changed assignment between confirmation and final manual submission', async () => {
  let changed = false;
  const mock = mount('/asistencias/manual', (path) =>
    path === `/api/assignments/${assignmentId}` && changed
      ? Response.json({ ...assignment, version: 2 })
      : undefined,
  );
  await prepareManual();
  const button = await screen.findByRole('button', { name: 'Confirmar captura manual' });
  changed = true;
  fireEvent.click(button);
  await screen.findByText(/El registro cambió/);
  expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});
it('renders assignment read failure and explicit retry without submitting', async () => {
  mount('/asistencias/manual', (path) =>
    path.startsWith('/api/assignments?') ? Response.json({}, { status: 503 }) : undefined,
  );
  fireEvent.change(await screen.findByLabelText(/Seleccionar observador/), {
    target: { value: id },
  });
  fireEvent.change(await screen.findByLabelText(/Seleccionar operativo/), {
    target: { value: id },
  });
  await screen.findByText('No se pudieron consultar asignaciones.');
  expect(screen.getByRole('button', { name: 'Reintentar asignaciones' })).toBeTruthy();
});

it('handles a competing manual creation after preflight as a single rejected write', async () => {
  const mock = mount('/asistencias/manual', (path, init) =>
    path === '/api/attendance/manual' && init?.method === 'POST'
      ? Response.json({}, { status: 409 })
      : undefined,
  );
  await prepareManual();
  const button = await screen.findByRole('button', { name: 'Confirmar captura manual' });
  fireEvent.click(button);
  fireEvent.click(button);
  await screen.findByText(/Conflicto:/);
  expect(mock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  expect(screen.queryByText(/Captura manual confirmada por el servidor/)).toBeNull();
});
