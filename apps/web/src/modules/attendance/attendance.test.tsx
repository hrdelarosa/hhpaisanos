import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from '../../app/App';
import { attendanceDaySchema, todaySchema } from './schemas/attendance';

const observer = {
  id: 'synthetic-observer',
  username: 'observer',
  fullName: 'Persona sintética',
  role: 'OBSERVADOR',
  permissions: ['attendance:read-own'],
  mustChangePassword: false,
};
const mark = {
  id: 'synthetic-mark',
  version: 2,
  officialTimestamp: '2026-11-14T15:30:00.123456Z',
  reviewStatus: 'accepted_administrative',
  anomalies: ['late_arrival', 'missing_location'],
};
const day = {
  assignmentId: 'synthetic-assignment',
  operativeName: 'Operativo sintético',
  moduleName: 'Módulo sintético',
  date: '2026-11-14',
  startTime: '09:00:00',
  endTime: '17:00:00',
  completeness: 'check_in_only',
  checkIn: mark,
  checkOut: null,
};
const today = { date: day.date, timeZone: 'America/Mexico_City', assignments: [day] };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function mount(path = '/mi-asistencia', response: unknown = today, user = observer) {
  window.history.replaceState(null, '', path);
  const fetchMock = vi.fn<typeof fetch>(async (path) => {
    if (path === '/api/auth/me') return Response.json(user);
    if (response instanceof Response) return response.clone();
    if (typeof response === 'function') return response(path);
    return Response.json(response);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  return fetchMock;
}

it('renders server date, assignment, schedule, official timestamp and independent states without sensitive data', async () => {
  mount('/mi-asistencia', {
    ...today,
    assignments: [
      {
        ...day,
        checkIn: {
          ...mark,
          latitude: 16.123456,
          longitude: -99.123456,
          receipt: { secret: 'private-receipt' },
        },
      },
    ],
  });
  await screen.findByRole('heading', { name: /2026-11-14 · Operativo sintético/ });
  expect(screen.getByText(/Fecha civil del servidor/).textContent).toContain('America/Mexico_City');
  expect(screen.getByText('Módulo sintético')).toBeTruthy();
  expect(screen.getByText(/Entrada 09:00:00 · Salida 17:00:00/)).toBeTruthy();
  expect(screen.getByText(mark.officialTimestamp).getAttribute('datetime')).toBe(
    mark.officialTimestamp,
  );
  for (const text of [
    'Solo entrada registrada',
    'Aceptada administrativamente',
    'Llegada tardía',
    'Sin ubicación',
    'Sin registro de salida.',
  ])
    expect(screen.getByText(text)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/16\.123456|-99\.123456|private-receipt/);
  expect(screen.queryByRole('button', { name: /Registrar/ })).toBeNull();
});

it.each([
  ['none', null, null, 'Sin marcas'],
  ['check_in_only', mark, null, 'Solo entrada registrada'],
  ['check_out_only', null, mark, 'Solo salida registrada'],
  ['complete', mark, mark, 'Entrada y salida registradas'],
])(
  'renders capture completeness %s without inferring absence',
  async (completeness, checkIn, checkOut, label) => {
    mount('/mi-asistencia', {
      ...today,
      assignments: [{ ...day, completeness, checkIn, checkOut }],
    });
    await screen.findByText(label);
    expect(screen.queryByText(/^Ausente$/)).toBeNull();
    expect(screen.queryByText('No tienes una asignación elegible para hoy.')).toBeNull();
  },
);

it.each([
  ['accepted_automatic', 'Aceptada automáticamente'],
  ['pending_review', 'Pendiente de revisión'],
  ['accepted_administrative', 'Aceptada administrativamente'],
  ['rejected', 'Rechazada'],
  ['annulled', 'Anulada'],
])(
  'renders individual review state %s and retains factual anomalies',
  async (reviewStatus, label) => {
    mount('/mi-asistencia', {
      ...today,
      assignments: [
        {
          ...day,
          checkIn: { ...mark, reviewStatus },
          checkOut: { ...mark, reviewStatus: 'pending_review', anomalies: ['early_departure'] },
        },
      ],
    });
    await screen.findByText('Salida temprana');
    const entry = screen.getByRole('heading', { name: 'Entrada' }).closest('section')!;
    expect(within(entry).getByText(label)).toBeTruthy();
    expect(within(entry).getByText('Llegada tardía')).toBeTruthy();
  },
);

it('distinguishes no eligible assignment from no marks', async () => {
  mount('/mi-asistencia', { ...today, assignments: [] });
  await screen.findByText('No tienes una asignación elegible para hoy.');
  expect(screen.queryByText('Sin marcas')).toBeNull();
});

it.each(['/mi-asistencia', '/mi-asistencia/historial'])(
  'shows loading before receiving %s',
  async (path) => {
    mount(path, () => new Promise<Response>(() => {}));
    await screen.findByText(
      path.endsWith('historial') ? 'Cargando historial…' : 'Cargando asistencia de hoy…',
    );
    expect(screen.queryByText('Sin marcas')).toBeNull();
  },
);

it.each(['/mi-asistencia', '/mi-asistencia/historial'])(
  'handles errors and manual retry for %s',
  async (path) => {
    const fetchMock = mount(path, new Response(null, { status: 503 }));
    await screen.findByRole('alert');
    const attempts = fetchMock.mock.calls.length;
    fetchMock.mockImplementation(async (url) =>
      url === '/api/auth/me'
        ? Response.json(observer)
        : Response.json(
            path.endsWith('historial')
              ? { items: [], total: 0, page: 1, limit: 20 }
              : { ...today, assignments: [] },
          ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('status');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(fetchMock.mock.calls.length).toBe(attempts + 1);
  },
);

it('keeps an ordinary API 403 distinct from session expiry', async () => {
  mount('/mi-asistencia', new Response(null, { status: 403 }));
  await screen.findByText(/No se autorizó la consulta/);
  expect(screen.getByText('Persona sintética', { selector: 'header p' })).toBeTruthy();
});

it('uses the existing 401 session handling', async () => {
  mount('/mi-asistencia', new Response(null, { status: 401 }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  expect(screen.queryByText('Operativo sintético')).toBeNull();
});

it.each([
  ['OBSERVADOR', []],
  ['ADMIN', ['attendance:read-own']],
  ['ENLACE', ['attendance:read-own']],
])(
  'blocks %s without the required role/permission pair on both routes',
  async (role, permissions) => {
    const fetchMock = mount('/mi-asistencia/historial', today, { ...observer, role, permissions });
    await screen.findByText('No tienes permiso para consultar asistencia personal.');
    expect(fetchMock.mock.calls.every(([path]) => path === '/api/auth/me')).toBe(true);
  },
);

it('requires authentication before reading attendance', async () => {
  window.history.replaceState(null, '', '/mi-asistencia');
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  expect(fetchMock.mock.calls.every(([path]) => path === '/api/auth/me')).toBe(true);
});

it('uses only supported date filters, preserves URL context and resets bounded pagination', async () => {
  const fetchMock = mount(
    '/mi-asistencia/historial?page=2&limit=1&context=synthetic',
    (path: string) => {
      const params = new URL(path, window.location.origin).searchParams;
      return Response.json({
        items: [day],
        total: 3,
        page: Number(params.get('page')),
        limit: Number(params.get('limit')),
      });
    },
  );
  await screen.findByText('Página 2 de 3 · 3 registros');
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 3 de 3 · 3 registros');
  expect((screen.getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  await screen.findByText('Página 2 de 3 · 3 registros');
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
  await screen.findByText('Página 1 de 3 · 3 registros');
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-14' } });
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([path]) => typeof path === 'string' && path.includes('from=2026-11-01&to=2026-11-14'),
      ),
    ).toBe(true),
  );
  expect(window.location.search).toContain('context=synthetic');
  await screen.findByText('Página 1 de 3 · 3 registros');
  expect((screen.getByRole('button', { name: 'Anterior' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.change(screen.getByLabelText('Registros por página'), { target: { value: '100' } });
  await screen.findByText('Página 1 de 1 · 3 registros');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar fechas' }));
  await waitFor(() => expect(window.location.search).not.toMatch(/from=|to=/));
});

it.each(['page=0&limit=101', 'page=1000001&limit=0', 'page=2garbage&limit=-1'])(
  'bounds invalid URL pagination %s',
  async (search) => {
    const fetchMock = mount(`/mi-asistencia/historial?${search}`, {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    await screen.findByText('No hay registros en esta página para las fechas seleccionadas.');
    expect(
      fetchMock.mock.calls.some(([path]) => path === '/api/attendance/me?page=1&limit=20'),
    ).toBe(true);
  },
);

it.each(['from=2026-11-15&to=2026-11-01', 'from=2026-02-30', 'to=0999-01-01'])(
  'rejects invalid URL dates without API calls %s',
  async (search) => {
    const fetchMock = mount(`/mi-asistencia/historial?${search}`);
    await screen.findByRole('alert');
    expect(fetchMock.mock.calls.every(([path]) => path === '/api/auth/me')).toBe(true);
  },
);

it('excludes GPS and receipts from parsed state, not only from the DOM', () => {
  const parsed = attendanceDaySchema.parse({
    ...day,
    receipt: 'private-receipt',
    checkIn: {
      ...mark,
      latitude: 16.123456,
      longitude: -99.123456,
      locationEvidence: { coordinates: [16, -99] },
      receipt: 'private-receipt',
    },
  });
  expect(parsed).toEqual(day);
  expect(todaySchema.safeParse({ ...today, date: '2026-02-30' }).success).toBe(false);
});

it('shows invalid backend contracts as errors rather than fabricated attendance', async () => {
  mount('/mi-asistencia', {
    ...today,
    assignments: [{ ...day, checkIn: { ...mark, reviewStatus: 'invented' } }],
  });
  await screen.findByRole('alert');
  expect(screen.queryByText('Sin marcas')).toBeNull();
});
