import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from '../../app/App';

const id = '019a7fb0-0000-7000-8000-000000000001';
const userId = '019a7fb0-0000-7000-8000-000000000002';
const profile = {
  id,
  firstNames: 'Perfil',
  lastNames: 'Sintético',
  phone: null,
  active: true,
  userId: null as string | null,
  createdAt: '2026-11-15 10:00:00.123456',
  updatedAt: '2026-11-15 10:00:00.123456',
};
const account = { id: userId, username: ' Exact Á ', fullName: 'Persona sintética' };
const session = {
  id: 'synthetic-enlace',
  username: 'enlace',
  fullName: 'Operador sintético',
  role: 'ENLACE',
  permissions: ['observers:read', 'observers:link-account'],
  mustChangePassword: false,
};
type Handler = (url: string, options?: RequestInit) => Response | Promise<Response>;
function mount(
  handler: Handler = (url) => Response.json(url.includes('linkable-account') ? account : profile),
  user = session,
) {
  window.history.replaceState(null, '', `/observadores/${id}`);
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
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});
const writes = (mock: ReturnType<typeof mount>) =>
  mock.mock.calls.filter(([, options]) => options?.method === 'PUT');
async function lookup() {
  await screen.findByLabelText('Usuario exacto de la cuenta');
  fireEvent.change(screen.getByLabelText('Usuario exacto de la cuenta'), {
    target: { value: account.username },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar cuenta elegible' }));
  await screen.findByText(/Cuenta elegible:/);
}
async function prepare() {
  await lookup();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Motivo de vinculación'), {
    target: { value: 'Acreditación institucional sintética' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar vinculación' }));
  await screen.findByRole('heading', { name: 'Confirmar vinculación supervisada' });
}
it.each(['ADMIN', 'ENLACE'])(
  'links using exact authorized contract and invalidates both domains for %s',
  async (role) => {
    let current = { ...profile };
    const invalidation = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const mock = mount(
      (url, options) => {
        if (options?.method === 'PUT') {
          current.userId = userId;
          return new Response(null, { status: 204 });
        }
        return Response.json(
          url.includes('linkable-account') ? { ...account, passwordHash: 'hidden' } : current,
        );
      },
      { ...session, role },
    );
    await prepare();
    expect(writes(mock)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vinculación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vinculación' }));
    await screen.findByText(/Vinculación confirmada por el servidor/);
    expect(writes(mock)).toHaveLength(1);
    expect(JSON.parse(writes(mock)[0][1]?.body as string)).toEqual({
      userId,
      verificationMethod: 'supervised_administrative',
      reason: 'Acreditación institucional sintética',
    });
    expect(new Headers(writes(mock)[0][1]?.headers).get('X-HHP-CSRF')).toBe('1');
    expect(invalidation).toHaveBeenCalledWith({ queryKey: ['users'] });
    expect(invalidation).toHaveBeenCalledWith({ queryKey: ['observers'] });
    await screen.findByText(/Relación actual:/);
    expect(
      mock.mock.calls.some(([url]) => typeof url === 'string' && url.startsWith('/api/users')),
    ).toBe(false);
    expect(screen.queryByText('hidden')).toBeNull();
    const lookupUrl = mock.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('linkable-account'),
    )![0] as string;
    expect(new URL(lookupUrl, location.origin).searchParams.get('username')).toBe(account.username);
  },
);
it('requires a real link grant and profile read; role name grants no bypass', async () => {
  const mock = mount(undefined, { ...session, role: 'ADMIN', permissions: ['observers:read'] });
  await screen.findByRole('heading', { name: 'Perfil Sintético' });
  expect(screen.queryByLabelText('Usuario exacto de la cuenta')).toBeNull();
  expect(writes(mock)).toHaveLength(0);
});
it('denies a link-only session access to profile selection without read permission', async () => {
  const mock = mount(undefined, { ...session, permissions: ['observers:link-account'] });
  await screen.findByText(/No tienes permiso para esta sección/);
  expect(mock.mock.calls.filter(([url]) => url !== '/api/auth/me')).toHaveLength(0);
});
it.each([false, true])(
  'shows unavailable or existing relationship states without replacement (%s)',
  async (linked) => {
    mount(() => Response.json({ ...profile, active: linked, userId: linked ? userId : null }));
    await screen.findByText(
      linked
        ? /No se admite desvincular ni reemplazar/
        : /no es elegible para una nueva vinculación/,
    );
    expect(screen.queryByLabelText('Usuario exacto de la cuenta')).toBeNull();
  },
);
it('does not treat username or name matching as identity evidence; requires attestation and reason', async () => {
  const mock = mount();
  await lookup();
  fireEvent.click(screen.getByRole('button', { name: 'Revisar vinculación' }));
  await screen.findByText('Confirma la acreditación supervisada antes de continuar.');
  expect(writes(mock)).toHaveLength(0);
  expect(screen.queryByRole('heading', { name: 'Confirmar vinculación supervisada' })).toBeNull();
});
it('cancels without writing and clears the attestation', async () => {
  const mock = mount();
  await prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  expect(writes(mock)).toHaveLength(0);
});
it.each([400, 403, 404, 409])(
  'handles unavailable, revoked, invalid or conflicting states (%s)',
  async (status) => {
    const mock = mount((url, options) =>
      options?.method === 'PUT'
        ? Response.json({}, { status })
        : Response.json(url.includes('linkable-account') ? account : profile),
    );
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vinculación' }));
    await screen.findByRole('alert');
    expect(writes(mock)).toHaveLength(1);
    expect(screen.queryByText(/Resultado incierto/)).toBeNull();
    expect(screen.queryByText(/Vinculación confirmada por el servidor/)).toBeNull();
  },
);
it('keeps ineligible account lookup indistinguishable from absent accounts', async () => {
  mount((url) =>
    url.includes('linkable-account') ? Response.json({}, { status: 404 }) : Response.json(profile),
  );
  await screen.findByLabelText('Usuario exacto de la cuenta');
  fireEvent.change(screen.getByLabelText('Usuario exacto de la cuenta'), {
    target: { value: 'missing' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar cuenta elegible' }));
  await screen.findByText(/no se distingue una cuenta inexistente/);
  expect(screen.queryByRole('checkbox')).toBeNull();
});
it.each(['linked', 'inactive', 'edited', 'account-revoked', 'account-changed', 'offline'])(
  'blocks stale or unavailable final preflight (%s)',
  async (state) => {
    let stale = false;
    const mock = mount((url) => {
      if (stale && state === 'offline') throw new TypeError('offline');
      if (url.includes('linkable-account'))
        return stale && state === 'account-revoked'
          ? Response.json({}, { status: 404 })
          : Response.json(
              stale && state === 'account-changed' ? { ...account, fullName: 'Cambio' } : account,
            );
      return Response.json(
        stale
          ? {
              ...profile,
              ...(state === 'linked'
                ? { userId }
                : state === 'inactive'
                  ? { active: false }
                  : state === 'edited'
                    ? { firstNames: 'Cambio' }
                    : {}),
            }
          : profile,
      );
    });
    await prepare();
    stale = true;
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vinculación' }));
    await screen.findByRole('alert');
    expect(writes(mock)).toHaveLength(0);
    expect(screen.queryByText(/Resultado incierto/)).toBeNull();
  },
);
it.each(['network', 'server'])(
  'keeps uncertain %s writes separate from success and never retries',
  async (state) => {
    let current = { ...profile };
    const mock = mount((url, options) => {
      if (options?.method === 'PUT') {
        current.userId = userId;
        if (state === 'network') throw new TypeError('lost response');
        return Response.json({}, { status: 500 });
      }
      return Response.json(url.includes('linkable-account') ? account : current);
    });
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vinculación' }));
    await screen.findByText(/Resultado incierto/);
    await screen.findByText(/Relación actual:/);
    expect(writes(mock)).toHaveLength(1);
    expect(screen.queryByText(/Vinculación confirmada por el servidor/)).toBeNull();
  },
);
it('keeps late linking completion isolated after logout', async () => {
  let resolve!: (response: Response) => void;
  const mock = mount((url, options) =>
    options?.method === 'PUT'
      ? new Promise((r) => {
          resolve = r;
        })
      : url === '/api/auth/logout'
        ? new Response(null, { status: 204 })
        : Response.json(url.includes('linkable-account') ? account : profile),
  );
  await prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar vinculación' }));
  await waitFor(() => expect(writes(mock)).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  await act(async () => resolve(new Response(null, { status: 204 })));
  expect(screen.queryByText(/Vinculación confirmada/)).toBeNull();
  expect(screen.queryByText(account.fullName)).toBeNull();
});
