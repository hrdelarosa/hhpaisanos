import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { App } from '../../app/App';
import { createModuleSchema, editModuleSchema, statusSchema } from './schemas/attention-modules';

const id = '019a7fb0-0000-7000-8000-000000000001';
const module = {
  id,
  name: 'Módulo sintético',
  municipality: 'Acapulco',
  active: true,
  createdAt: '2026-11-14T10:00:00.123456Z',
  updatedAt: '2026-11-14T10:00:00.123456Z',
};
const user = {
  id: 'synthetic-admin',
  username: 'admin',
  fullName: 'Persona sintética',
  role: 'ADMIN',
  permissions: [
    'attention-modules:read',
    'attention-modules:create',
    'attention-modules:update',
    'attention-modules:change-status',
  ],
  mustChangePassword: false,
};
const list = { items: [module], page: 1, limit: 20, total: 1 };
type Handler = (path: string, options?: RequestInit) => Response | Promise<Response>;
function mount(
  path: string,
  handler: Handler = (url) => Response.json(url.includes('?') ? list : module),
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

it('lists server-provided context and preserves filters when visiting details', async () => {
  mount('/modulos?active=true');
  await screen.findByRole('rowheader', { name: module.name });
  expect(screen.getByText('Acapulco')).toBeTruthy();
  expect(screen.getByRole('cell', { name: 'Activo' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: `Ver detalle de ${module.name}` }));
  await screen.findByRole('heading', { name: module.name });
  expect(screen.getAllByText(module.createdAt, { selector: 'time' })).toHaveLength(2);
  fireEvent.click(screen.getByRole('link', { name: 'Volver a módulos' }));
  await screen.findByRole('rowheader', { name: module.name });
  expect(window.location.search).toContain('active=true');
});
it('uses only supported URL filters, resets page, and paginates in server order', async () => {
  const mock = mount('/modulos?page=2&limit=1&context=keep', (url) => {
    const params = new URL(url, window.location.origin).searchParams;
    return Response.json({
      ...list,
      page: Number(params.get('page')),
      limit: Number(params.get('limit')),
      total: 3,
    });
  });
  await screen.findByText('Página 2 de 3 · 3 registros');
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 3 de 3 · 3 registros');
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '%Nombre_' } });
  await screen.findByText('Página 1 de 3 · 3 registros');
  fireEvent.change(screen.getByLabelText('Municipio (coincidencia exacta)'), {
    target: { value: 'Acapulco' },
  });
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'false' } });
  await waitFor(() =>
    expect(
      mock.mock.calls.some(
        ([url]) =>
          typeof url === 'string' &&
          url.includes('name=%25Nombre_&municipality=Acapulco&active=false'),
      ),
    ).toBe(true),
  );
  expect(window.location.search).toContain('context=keep');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  await waitFor(() => expect(window.location.search).not.toMatch(/name=|municipality=|active=/));
});
it.each(['page=0&limit=101&active=invalid', 'page=9007199254740991&limit=0', 'page=2bad&limit=-1'])(
  'bounds invalid URL values %s',
  async (search) => {
    const mock = mount(`/modulos?${search}`);
    await screen.findByRole('rowheader');
    expect(mock.mock.calls.some(([url]) => url === '/api/attention-modules?page=1&limit=20')).toBe(
      true,
    );
  },
);
it('does not send overlong filters', async () => {
  const mock = mount(`/modulos?municipality=${'a'.repeat(101)}`);
  await screen.findByRole('alert');
  expect(mock.mock.calls).toHaveLength(1);
});
it.each(['/modulos', `/modulos/${id}`])(
  'shows loading, error, retry and empty/detail on %s',
  async (path) => {
    let respond: Handler = () => new Promise(() => {});
    mount(path, (url, options) => respond(url, options));
    await screen.findByText(
      path === '/modulos' ? 'Cargando módulos…' : 'Cargando detalle del módulo…',
    );
    cleanup();
    respond = () => new Response(null, { status: 503 });
    render(<App />);
    await screen.findByRole('alert');
    respond = () => Response.json(path === '/modulos' ? { ...list, items: [], total: 0 } : module);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    if (path === '/modulos')
      await screen.findByText('No hay módulos en esta página para los filtros seleccionados.');
    else await screen.findByRole('heading', { name: module.name });
  },
);
it.each(['/modulos', '/modulos/nuevo', '/MODULOS/NUEVO/', `/modulos/${id}`])(
  'never bypasses permissions for ADMIN on %s',
  async (path) => {
    const mock = mount(path, undefined, { ...user, permissions: [] });
    await screen.findByText('No tienes permiso para esta sección de módulos de atención.');
    expect(mock.mock.calls).toHaveLength(1);
  },
);
it('gates each operation by current permission, not ADMIN privileges', async () => {
  mount('/', undefined, { ...user, role: 'ENLACE', permissions: ['attention-modules:read'] });
  fireEvent.click(await screen.findByRole('link', { name: 'Módulos de atención' }));
  fireEvent.click(await screen.findByRole('link', { name: `Ver detalle de ${module.name}` }));
  await screen.findByRole('heading', { name: module.name });
  expect(screen.queryByRole('link', { name: 'Crear módulo' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Editar módulo' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Disponibilidad del módulo' })).toBeNull();
});
it.each(['attention-modules:update', 'attention-modules:change-status'])(
  'requires operation-specific permission %s',
  async (permission) => {
    mount(`/modulos/${id}`, undefined, {
      ...user,
      permissions: ['attention-modules:read', permission],
    });
    await screen.findByRole('heading', { name: module.name });
    expect(Boolean(screen.queryByRole('heading', { name: 'Editar módulo' }))).toBe(
      permission.endsWith(':update'),
    );
    expect(Boolean(screen.queryByRole('heading', { name: 'Disponibilidad del módulo' }))).toBe(
      permission.endsWith(':change-status'),
    );
  },
);

function fillCreation() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Módulo sintético  ' } });
  fireEvent.change(screen.getByLabelText('Municipio'), { target: { value: '  Acapulco  ' } });
}
it('validates creation, sends only editable fields and invalidates a cached list', async () => {
  const mock = mount('/modulos', (url, options) =>
    Response.json(options?.method === 'POST' || !url.includes('?') ? module : list),
  );
  await screen.findByRole('rowheader');
  fireEvent.click(screen.getByRole('link', { name: 'Crear módulo' }));
  await screen.findByRole('heading', { name: 'Crear módulo de atención' });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar módulo' }));
  await screen.findByText('Escribe el nombre.');
  await screen.findByText('Escribe el municipio.');
  expect(mock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar módulo' }));
  await screen.findByRole('heading', { name: module.name });
  const post = mock.mock.calls.find(([, options]) => options?.method === 'POST')![1]!;
  expect(JSON.parse(post.body as string)).toEqual({
    name: module.name,
    municipality: module.municipality,
  });
  expect(new Headers(post.headers).get('X-HHP-CSRF')).toBe('1');
  expect(post.credentials).toBe('same-origin');
  fireEvent.click(screen.getByRole('link', { name: 'Volver a módulos' }));
  await waitFor(() =>
    expect(
      mock.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.startsWith('/api/attention-modules?'),
      ),
    ).toHaveLength(2),
  );
});
it('confirms creation in place without requiring read permission', async () => {
  mount('/modulos/nuevo', () => Response.json(module), {
    ...user,
    permissions: ['attention-modules:create'],
  });
  await screen.findByRole('heading', { name: 'Crear módulo de atención' });
  fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar módulo' }));
  await screen.findByText('Módulo creado y activo, confirmado por el servidor.');
  expect(window.location.pathname).toBe('/modulos/nuevo');
});
it.each([400, 403, 409, 503])(
  'preserves creation inputs and safely summarizes HTTP %s without retry',
  async (status) => {
    const mock = mount(
      '/modulos/nuevo',
      () => new Response('unsafe raw server detail', { status }),
    );
    await screen.findByRole('heading', { name: 'Crear módulo de atención' });
    fillCreation();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar módulo' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toContain(module.name);
    expect(screen.queryByText('unsafe raw server detail')).toBeNull();
    expect(mock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  },
);
it('matches trimmed Unicode boundaries and required reasons', () => {
  expect(
    createModuleSchema.parse({ name: ` ${'😀'.repeat(120)} `, municipality: 'a'.repeat(100) }).name,
  ).toHaveLength(240);
  for (const input of [
    { name: '', municipality: 'ok' },
    { name: 'a'.repeat(121), municipality: 'ok' },
    { name: 'ok', municipality: 'a'.repeat(101) },
    { name: 'ok', municipality: null },
  ])
    expect(createModuleSchema.safeParse(input).success).toBe(false);
  for (const reason of ['', '   ', '😀'.repeat(501)]) {
    expect(editModuleSchema.safeParse({ ...module, reason }).success).toBe(false);
    expect(statusSchema.safeParse({ reason }).success).toBe(false);
  }
});

function fillEdit() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nombre actualizado' } });
  fireEvent.change(screen.getByLabelText('Motivo de edición'), {
    target: { value: 'Corrección sintética' },
  });
}
it('explains unchanged edits without sending an empty PATCH', async () => {
  const mock = mount(`/modulos/${id}`);
  await screen.findByRole('heading', { name: module.name });
  fireEvent.change(screen.getByLabelText('Motivo de edición'), {
    target: { value: 'Motivo sintético' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText('No hay cambios que guardar.');
  expect(mock.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
});
it.each([400, 403, 503, 'network'])(
  'preserves edit inputs after rejected or uncertain %s results without retries',
  async (status) => {
    const mock = mount(`/modulos/${id}`, (_url, options) => {
      if (options?.method !== 'PATCH') return Response.json(module);
      if (status === 'network') throw new TypeError('Failed to fetch');
      return new Response(null, { status: Number(status) });
    });
    await screen.findByRole('heading', { name: module.name });
    fillEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Nombre actualizado');
    expect(mock.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1);
    expect(screen.queryByText(/Edición confirmada/)).toBeNull();
  },
);
it('treats an unexpected successful creation response as uncertain, not as confirmation', async () => {
  mount('/modulos/nuevo', () => Response.json({ ...module, active: false }));
  await screen.findByRole('heading', { name: 'Crear módulo de atención' });
  fillCreation();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar módulo' }));
  await screen.findByText(/No se confirmó el resultado/);
  expect(window.location.pathname).toBe('/modulos/nuevo');
});
it('edits only changed fields, requires a reason and refreshes confirmed server data', async () => {
  let current = { ...module };
  const mock = mount(`/modulos/${id}`, (_url, options) => {
    if (options?.method === 'PATCH') {
      current = {
        ...current,
        name: 'Nombre actualizado',
        updatedAt: '2026-11-14T10:01:00.123456Z',
      };
      return new Response(null, { status: 204 });
    }
    return Response.json(current);
  });
  await screen.findByRole('heading', { name: module.name });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText('Escribe el motivo administrativo.');
  fillEdit();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByRole('heading', { name: 'Nombre actualizado' });
  const patch = mock.mock.calls.find(([, options]) => options?.method === 'PATCH')![1]!;
  expect(JSON.parse(patch.body as string)).toEqual({
    name: 'Nombre actualizado',
    reason: 'Corrección sintética',
  });
  expect(mock.mock.calls.filter(([url]) => url === `/api/attention-modules/${id}`)).toHaveLength(4);
});
it('rejects stale edits without sending PATCH and permits explicit reload of the form', async () => {
  let current = { ...module };
  const mock = mount(`/modulos/${id}`, () => Response.json(current));
  await screen.findByRole('heading', { name: module.name });
  fillEdit();
  current = { ...current, municipality: 'Chilpancingo' };
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText(/El módulo cambió/);
  expect(mock.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Cargar datos del detalle' }));
  expect((screen.getByLabelText('Municipio') as HTMLInputElement).value).toBe('Chilpancingo');
});
it('handles existing/cancelled assignment conflicts without exposing raw errors or changing data', async () => {
  const mock = mount(`/modulos/${id}`, (_url, options) =>
    options?.method === 'PATCH' ? new Response(null, { status: 409 }) : Response.json(module),
  );
  await screen.findByRole('heading', { name: module.name });
  fillEdit();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText(/Hay un conflicto/);
  expect(screen.getByRole('heading', { name: module.name })).toBeTruthy();
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Nombre actualizado');
  expect(mock.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1);
});

async function prepareStatus(active = true) {
  await screen.findByRole('heading', { name: module.name });
  fireEvent.change(screen.getByLabelText('Motivo del cambio de estado'), {
    target: { value: 'Disponibilidad autorizada' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: active ? 'Revisar desactivación' : 'Revisar activación' }),
  );
  await screen.findByRole('heading', {
    name: active ? 'Confirmar desactivación' : 'Confirmar activación',
  });
}
it.each([true, false])(
  'confirms %s -> inverse only after rereading state and invalidates list/detail',
  async (active) => {
    let current = { ...module, active };
    const mock = mount('/modulos', (url, options) => {
      if (options?.method === 'PATCH') {
        current = { ...current, active: !active };
        return new Response(null, { status: 204 });
      }
      return Response.json(url.includes('?') ? { ...list, items: [current] } : current);
    });
    await screen.findByRole('rowheader');
    fireEvent.click(screen.getByRole('link', { name: `Ver detalle de ${module.name}` }));
    await prepareStatus(active);
    expect(mock.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await prepareStatus(active);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de estado' }));
    await screen.findByText('Cambio de estado confirmado por el servidor.');
    await screen.findByText(active ? 'Inactivo' : 'Activo');
    const patch = mock.mock.calls.find(
      ([url, options]) =>
        typeof url === 'string' && url.endsWith('/status') && options?.method === 'PATCH',
    )!;
    expect(JSON.parse(patch[1]!.body as string)).toEqual({
      active: !active,
      reason: 'Disponibilidad autorizada',
    });
    fireEvent.click(screen.getByRole('link', { name: 'Volver a módulos' }));
    await waitFor(() =>
      expect(
        mock.mock.calls.filter(
          ([url]) => typeof url === 'string' && url.includes('/api/attention-modules?'),
        ),
      ).toHaveLength(2),
    );
  },
);
it.each(['before-review', 'after-review'])(
  'detects concurrent status changes %s and never silently reverses them',
  async (when) => {
    let current = { ...module };
    const mock = mount(`/modulos/${id}`, () => Response.json(current));
    if (when === 'after-review') await prepareStatus();
    else {
      await screen.findByRole('heading', { name: module.name });
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
    await screen.findByText(/El módulo cambió/);
    expect(mock.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Confirmar cambio de estado' })).toBeNull();
  },
);
it.each([400, 403, 409, 503, 'network'])(
  'handles status rejection/uncertainty %s without optimism or write retries',
  async (status) => {
    const mock = mount(`/modulos/${id}`, (_url, options) => {
      if (options?.method !== 'PATCH') return Response.json(module);
      if (status === 'network') throw new TypeError('Failed to fetch');
      return new Response(null, { status: Number(status) });
    });
    await prepareStatus();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de estado' }));
    await screen.findByRole('alert');
    await screen.findByRole('button', { name: 'Revisar desactivación' });
    expect(screen.getByText('Activo')).toBeTruthy();
    expect(screen.queryByText('Cambio de estado confirmado por el servidor.')).toBeNull();
    expect(mock.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1);
  },
);
