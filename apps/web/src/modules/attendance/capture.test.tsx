import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { focusManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, useRoutes } from 'react-router';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { AppProviders } from '../../app/providers';
import { routes } from '../../app/routes';
import type { AuthUser } from '../auth/schemas/auth';
import type { AttendanceDay, AttendanceMark } from './schemas/attendance';

const assignmentId = '019adb22-0000-7000-8000-000000000001';
const markId = '019adb22-0000-7000-8000-000000000002';
const observer: AuthUser = {
  id: 'synthetic-observer-a',
  username: 'observer',
  fullName: 'Persona sintética A',
  role: 'OBSERVADOR',
  permissions: ['attendance:read-own', 'attendance:capture-own'],
  mustChangePassword: false,
};
const evidence = { latitude: 16.123456, longitude: -99.123456, accuracy: 5 };
const mark: AttendanceMark = {
  id: markId,
  version: 1,
  officialTimestamp: '2026-11-14T15:30:00.123456Z',
  reviewStatus: 'pending_review',
  anomalies: ['late_arrival', 'missing_location'],
};
const day: AttendanceDay = {
  assignmentId,
  operativeName: 'Operativo sintético',
  moduleName: 'Módulo sintético',
  date: '2026-11-14',
  startTime: '09:00:00',
  endTime: '17:00:00',
  completeness: 'none',
  checkIn: null,
  checkOut: null,
};
let client: QueryClient;
function TestApp() {
  const queryClient = useQueryClient();
  useEffect(() => {
    client = queryClient;
  });
  return useRoutes(routes);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
type Handler = (path: string, options?: RequestInit) => Promise<Response>;
function mount(handler?: Handler, user: AuthUser = observer, initial = day) {
  let current = initial;
  const fetchMock = vi.fn<typeof fetch>(async (path, options) => {
    if (typeof path !== 'string') throw new Error('Expected same-origin path');
    if (path === '/api/auth/me') return Response.json(user);
    if (path.includes('/check-')) {
      if (handler) return handler(path, options);
      current = { ...day, completeness: 'check_in_only', checkIn: mark };
      return Response.json({ attendanceId: markId, state: 'pending_review' });
    }
    if (path === '/api/attendance/me/today')
      return Response.json({
        date: current.date,
        timeZone: 'America/Mexico_City',
        assignments: [current],
      });
    if (path.startsWith('/api/attendance/me?'))
      return Response.json({ items: [current], total: 1, page: 1, limit: 100 });
    if (handler) return handler(path, options);
    throw new Error('Unexpected request');
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('isSecureContext', true);
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({ coords: evidence } as GeolocationPosition),
  );
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
  window.history.replaceState(null, '', '/mi-asistencia');
  render(
    <AppProviders>
      <BrowserRouter>
        <TestApp />
      </BrowserRouter>
    </AppProviders>,
  );
  return { fetchMock, getCurrentPosition };
}
const captures = (mock: ReturnType<typeof vi.fn<typeof fetch>>) =>
  mock.mock.calls.filter(([path]) => typeof path === 'string' && path.includes('/check-'));
afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'geolocation');
  window.history.replaceState(null, '', '/');
});

it('requests GPS only after explicit intent, prevents duplicate clicks and confirms only from the server', async () => {
  const pending = deferred<Response>();
  const { fetchMock, getCurrentPosition } = mount(() => pending.promise);
  const button = await screen.findByRole('button', { name: 'Registrar entrada' });
  expect(getCurrentPosition).not.toHaveBeenCalled();
  fireEvent.click(button);
  fireEvent.click(button);
  await screen.findByText('Enviando captura al servidor…');
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(captures(fetchMock)).toHaveLength(1);
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText('Solicitud confirmada por el servidor.')).toBeNull();
  const [, options] = captures(fetchMock)[0];
  expect(options).toMatchObject({
    method: 'POST',
    credentials: 'same-origin',
    body: JSON.stringify({ assignmentId, expectedDate: day.date, location: evidence }),
  });
  expect((options!.headers as Headers).get('X-HHP-CSRF')).toBe('1');
  expect((options!.headers as Headers).get('Idempotency-Key')).toMatch(/^[0-9a-f]{64}$/);
  expect(
    JSON.stringify(
      client
        .getMutationCache()
        .getAll()
        .map((m) => ({
          variables: m.state.variables,
          data: m.state.data,
          context: m.state.context,
          meta: m.meta,
        })),
    ),
  ).not.toContain('16.123456');
  pending.resolve(Response.json({ attendanceId: markId, state: 'pending_review' }));
  await screen.findByText('Estado original confirmado: Pendiente de revisión.');
  expect(document.body.textContent).not.toMatch(/16\.123456|-99\.123456/);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
});

it('renders refreshed server review and anomalies and enables checkout from a usable entry', async () => {
  const { fetchMock } = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  const result = await screen.findByRole('region', { name: 'Resultado de captura' });
  await within(result).findByText('Llegada tardía');
  expect(within(result).getByText('Sin ubicación')).toBeTruthy();
  expect(within(result).getByText(mark.officialTimestamp)).toBeTruthy();
  await screen.findByRole('button', { name: 'Registrar salida' });
  expect(
    fetchMock.mock.calls.filter(([path]) => path === '/api/attendance/me/today').length,
  ).toBeGreaterThan(1);
});

it.each([1, 2, 3, 99])('allows capture with browser location failure %s', async (code) => {
  const { fetchMock, getCurrentPosition } = mount();
  getCurrentPosition.mockImplementation((...args: unknown[]) => {
    (args[1] as PositionErrorCallback)({ code } as GeolocationPositionError);
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByText('Solicitud confirmada por el servidor.');
  const body = JSON.parse(captures(fetchMock)[0][1]!.body as string);
  expect(body.location).toEqual({
    missingReason:
      code === 1
        ? 'permission_denied'
        : code === 2
          ? 'position_unavailable'
          : code === 3
            ? 'timeout'
            : 'unexpected_error',
  });
  expect(screen.getByText(/requerirá revisión administrativa/)).toBeTruthy();
});

it('keeps exact retry evidence and ID across navigation and does not automatically retry a lost response', async () => {
  let attempt = 0;
  const { fetchMock, getCurrentPosition } = mount(async () => {
    if (++attempt === 1) throw new TypeError('Lost response with potentially sensitive text');
    return Response.json({ attendanceId: markId, state: 'pending_review' });
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByRole('button', { name: 'Reintentar la misma solicitud' });
  expect(captures(fetchMock)).toHaveLength(1);
  expect(screen.queryByText('Solicitud confirmada por el servidor.')).toBeNull();
  expect(
    (screen.getByRole('button', { name: 'Registrar entrada' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('link', { name: 'Historial' }));
  await screen.findByRole('heading', { name: 'Historial de mi asistencia' });
  fireEvent.click(screen.getByRole('link', { name: 'Hoy' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar la misma solicitud' }));
  await screen.findByText('Solicitud confirmada por el servidor.');
  const calls = captures(fetchMock);
  expect(calls).toHaveLength(2);
  expect(calls[1][0]).toBe(calls[0][0]);
  expect(calls[1][1]!.body).toBe(calls[0][1]!.body);
  expect((calls[1][1]!.headers as Headers).get('Idempotency-Key')).toBe(
    (calls[0][1]!.headers as Headers).get('Idempotency-Key'),
  );
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).not.toContain('potentially sensitive');
});

it.each([500, 503, 429, 408, 409, 403])(
  'retains the request for explicit exact retry after recoverable HTTP %s',
  async (status) => {
    const { fetchMock } = mount(async () => new Response(null, { status }));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar la misma solicitud' }));
    await waitFor(() => expect(captures(fetchMock)).toHaveLength(2));
    expect(captures(fetchMock)[1][1]!.body).toBe(captures(fetchMock)[0][1]!.body);
  },
);

it.each(['day_changed', 'initial_mark_exists', 'invalid_order', 'ineligible'])(
  'shows a confirmed server rejection %s and refreshes without retrying',
  async (code) => {
    const { fetchMock } = mount(async () =>
      Response.json({ code }, { status: code === 'ineligible' ? 403 : 409 }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
    await screen.findByText(/El servidor rechazó esta solicitud/);
    expect(screen.queryByRole('button', { name: 'Reintentar la misma solicitud' })).toBeNull();
    expect(captures(fetchMock)).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([path]) => path === '/api/attendance/me/today').length,
    ).toBeGreaterThan(1);
  },
);

it('treats an invalid success response as uncertain, never as confirmation', async () => {
  mount(async () =>
    Response.json({ attendanceId: markId, state: 'invented', latitude: evidence.latitude }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByRole('button', { name: 'Reintentar la misma solicitud' });
  expect(screen.queryByText('Solicitud confirmada por el servidor.')).toBeNull();
  expect(document.body.textContent).not.toMatch(/invented|16\.123456/);
});

it.each(['rejected', 'annulled'] as const)(
  'blocks checkout for an entry that is %s',
  async (reviewStatus) => {
    mount(undefined, observer, {
      ...day,
      checkIn: { ...mark, reviewStatus },
      completeness: 'check_in_only',
    });
    await screen.findByText(/No puedes registrar salida/);
    expect(screen.queryByRole('button', { name: 'Registrar salida' })).toBeNull();
  },
);

it('submits checkout to the actual checkout endpoint without inventing timestamps or status', async () => {
  const { fetchMock } = mount(undefined, observer, {
    ...day,
    checkIn: mark,
    completeness: 'check_in_only',
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar salida' }));
  await screen.findByText('Solicitud confirmada por el servidor.');
  expect(captures(fetchMock)[0][0]).toBe('/api/attendance/me/check-out');
  expect(Object.keys(JSON.parse(captures(fetchMock)[0][1]!.body as string))).toEqual([
    'assignmentId',
    'expectedDate',
    'location',
  ]);
});

it('does not enable capture for a read-only observer', async () => {
  const { getCurrentPosition } = mount(undefined, {
    ...observer,
    permissions: ['attendance:read-own'],
  });
  await screen.findByText('Sin marcas');
  expect(screen.queryByRole('button', { name: /Registrar entrada|Registrar salida/ })).toBeNull();
  expect(getCurrentPosition).not.toHaveBeenCalled();
});

it('does not send a delayed GPS result after the authenticated account changes', async () => {
  const { fetchMock, getCurrentPosition } = mount();
  getCurrentPosition.mockImplementation(() => {});
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByText('Solicitando ubicación…');
  fetchMock.mockImplementation(async (path) =>
    path === '/api/auth/me'
      ? Response.json({ ...observer, id: 'synthetic-observer-b', fullName: 'Persona sintética B' })
      : Response.json({ date: day.date, timeZone: 'America/Mexico_City', assignments: [day] }),
  );
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  await screen.findByLabelText('Cuenta de Persona sintética B, OBSERVADOR');
  await act(async () => {
    getCurrentPosition.mock.calls[0][0]({ coords: evidence } as GeolocationPosition);
  });
  expect(captures(fetchMock)).toHaveLength(0);
  expect(screen.queryByText(/La sesión cambió mientras/)).toBeNull();
});

it('continues location acquisition after a completed same-identity session revalidation', async () => {
  const { fetchMock, getCurrentPosition } = mount();
  getCurrentPosition.mockImplementation(() => {});
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByText('Solicitando ubicación…');
  const reads = fetchMock.mock.calls.filter(([path]) => path === '/api/auth/me').length;
  const implementation = fetchMock.getMockImplementation()!;
  const revalidation = deferred<Response>();
  fetchMock.mockImplementation((path, options) =>
    path === '/api/auth/me' ? revalidation.promise : implementation(path, options),
  );
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  await waitFor(() =>
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/me').length).toBeGreaterThan(
      reads,
    ),
  );
  await screen.findByText('Verificando sesión…');
  revalidation.resolve(Response.json(observer));
  await screen.findByLabelText('Cuenta de Persona sintética A, OBSERVADOR');
  await act(async () => {
    getCurrentPosition.mock.calls[0][0]({ coords: evidence } as GeolocationPosition);
  });
  await screen.findByText('Solicitud confirmada por el servidor.');
  expect(captures(fetchMock)).toHaveLength(1);
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
});

it('isolates a pending request on revocation and restores it only for the same authenticated account', async () => {
  const { fetchMock, getCurrentPosition } = mount(async () => new Response(null, { status: 401 }));
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  let nextUser = { ...observer, id: 'synthetic-observer-b', fullName: 'Persona sintética B' };
  fetchMock.mockImplementation(async (path) => {
    if (path === '/api/auth/me') return Response.json(nextUser);
    if (path === '/api/auth/login') return Response.json({ authenticated: true });
    if (path === '/api/auth/logout') return new Response(null, { status: 204 });
    if (path === '/api/attendance/me/check-in')
      return Response.json({ attendanceId: markId, state: 'pending_review' });
    if (typeof path === 'string' && path.includes('/api/attendance/me?'))
      return Response.json({ items: [], total: 0, page: 1, limit: 100 });
    return Response.json({ date: day.date, timeZone: 'America/Mexico_City', assignments: [day] });
  });
  async function login() {
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'synthetic' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'synthetic-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Asistencia personal' }));
  }
  await login();
  await screen.findByRole('button', { name: 'Registrar entrada' });
  expect(screen.queryByRole('button', { name: 'Reintentar la misma solicitud' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  nextUser = observer;
  await login();
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar la misma solicitud' }));
  await screen.findByText('Solicitud confirmada por el servidor.');
  expect(captures(fetchMock)).toHaveLength(2);
  expect(captures(fetchMock)[1][1]!.body).toBe(captures(fetchMock)[0][1]!.body);
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
});

it('retries the original expected date unchanged even after the server civil day changes', async () => {
  let attempt = 0;
  const { fetchMock } = mount(async () => {
    if (++attempt === 1) throw new TypeError('Lost response');
    return Response.json({ code: 'day_changed' }, { status: 409 });
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByRole('button', { name: 'Reintentar la misma solicitud' });
  fetchMock.mockImplementationOnce(async () =>
    Response.json({
      date: '2026-11-15',
      timeZone: 'America/Mexico_City',
      assignments: [{ ...day, date: '2026-11-15' }],
    }),
  );
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['attendance', 'today'] });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar la misma solicitud' }));
  await screen.findByText(/cambió la fecha civil/);
  expect(JSON.parse(captures(fetchMock)[1][1]!.body as string).expectedDate).toBe('2026-11-14');
});

it.each(['unsupported', 'insecure_context'] as const)(
  'does not block submission for %s',
  async (missingReason) => {
    const { fetchMock } = mount();
    if (missingReason === 'unsupported') Reflect.deleteProperty(navigator, 'geolocation');
    else vi.stubGlobal('isSecureContext', false);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
    await screen.findByText('Solicitud confirmada por el servidor.');
    expect(JSON.parse(captures(fetchMock)[0][1]!.body as string).location).toEqual({
      missingReason,
    });
  },
);

it('keeps location progress across route navigation and blocks repeated intentions', async () => {
  const { fetchMock, getCurrentPosition } = mount();
  getCurrentPosition.mockImplementation(() => {});
  const button = await screen.findByRole('button', { name: 'Registrar entrada' });
  fireEvent.click(button);
  fireEvent.click(button);
  await screen.findByText('Solicitando ubicación…');
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('link', { name: 'Historial' }));
  await screen.findByRole('heading', { name: 'Historial de mi asistencia' });
  fireEvent.click(screen.getByRole('link', { name: 'Hoy' }));
  await screen.findByText('Solicitando ubicación…');
  await act(async () => {
    getCurrentPosition.mock.calls[0][0]({ coords: evidence } as GeolocationPosition);
  });
  await screen.findByText('Solicitud confirmada por el servidor.');
  expect(captures(fetchMock)).toHaveLength(1);
});

it('does not claim exact recovery after the app is reloaded', async () => {
  mount(async () => {
    throw new TypeError('Uncertain');
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByRole('button', { name: 'Reintentar la misma solicitud' });
  cleanup();
  const { fetchMock, getCurrentPosition } = mount();
  await screen.findByRole('button', { name: 'Registrar entrada' });
  expect(screen.queryByRole('button', { name: 'Reintentar la misma solicitud' })).toBeNull();
  expect(screen.getByText(/no recupera su recibo exacto/)).toBeTruthy();
  expect(captures(fetchMock)).toHaveLength(0);
  expect(getCurrentPosition).not.toHaveBeenCalled();
});

it('distinguishes first-attempt validation rejection from a capture confirmation', async () => {
  mount(async () => new Response(null, { status: 400 }));
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByText(/El servidor rechazó los datos/);
  expect(screen.queryByText('Solicitud confirmada por el servidor.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reintentar la misma solicitud' })).toBeNull();
});

it('discloses a retry validation rejection without discarding an earlier uncertain request', async () => {
  let attempt = 0;
  const { fetchMock } = mount(async () => {
    if (++attempt === 1) throw new TypeError('Lost original response');
    return new Response(null, { status: 400 });
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar la misma solicitud' }));
  await screen.findByText(/El servidor rechazó este reintento, pero eso no confirma/);
  expect(screen.queryByText('Solicitud confirmada por el servidor.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar la misma solicitud' }));
  await waitFor(() => expect(captures(fetchMock)).toHaveLength(3));
  expect(captures(fetchMock)[2][1]!.body).toBe(captures(fetchMock)[0][1]!.body);
});

it('allows original-day terminal replay after midnight without requiring a new eligible assignment', async () => {
  const { fetchMock, getCurrentPosition } = mount(async () => {
    throw new TypeError('Lost response');
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
  await screen.findByRole('button', { name: 'Reintentar la misma solicitud' });
  fetchMock.mockImplementation(async (path) => {
    if (path === '/api/auth/me') return Response.json(observer);
    if (path === '/api/attendance/me/check-in')
      return Response.json({ attendanceId: markId, state: 'pending_review' });
    if (path === '/api/attendance/me/today')
      return Response.json({
        date: '2026-11-15',
        timeZone: 'America/Mexico_City',
        assignments: [],
      });
    return Response.json({
      items: [{ ...day, completeness: 'check_in_only', checkIn: mark }],
      total: 1,
      page: 1,
      limit: 100,
    });
  });
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['attendance', 'today'] });
  });
  await screen.findByText('No tienes una asignación elegible para hoy.');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar la misma solicitud' }));
  const result = await screen.findByRole('region', { name: 'Resultado de captura' });
  await within(result).findByText('Llegada tardía');
  expect(within(result).getByText(mark.officialTimestamp)).toBeTruthy();
  expect(captures(fetchMock)[1][1]!.body).toBe(captures(fetchMock)[0][1]!.body);
  expect((captures(fetchMock)[1][1]!.headers as Headers).get('Idempotency-Key')).toBe(
    (captures(fetchMock)[0][1]!.headers as Headers).get('Idempotency-Key'),
  );
  expect(
    fetchMock.mock.calls.some(
      ([path]) => path === '/api/attendance/me?page=1&limit=100&from=2026-11-14&to=2026-11-14',
    ),
  ).toBe(true);
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
});
