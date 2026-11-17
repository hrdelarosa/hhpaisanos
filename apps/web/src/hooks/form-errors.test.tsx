import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm, type ResolverResult } from 'react-hook-form';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { AppProviders } from '../app/providers';
import { AssignmentField } from '../modules/assignments/components/AssignmentField';
import { ResourcePicker } from '../modules/assignments/components/ResourcePicker';
import { useInvalidFieldFocus } from './use-invalid-field-focus';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('keeps existing descriptions and stable unique error IDs on repeated fields', () => {
  const view = render(
    <>
      <p id="help">Descripción existente.</p>
      <AssignmentField id="one" label="Primero" error="Primer error." aria-describedby="help" />
      <AssignmentField id="two" label="Segundo" error="Segundo error." aria-describedby="help" />
    </>,
  );
  const first = screen.getByRole('textbox', {
    name: 'Primero',
    description: 'Descripción existente. Primer error.',
  });
  const second = screen.getByRole('textbox', {
    name: 'Segundo',
    description: 'Descripción existente. Segundo error.',
  });
  const description = first.getAttribute('aria-describedby');
  expect(description).not.toBe(second.getAttribute('aria-describedby'));
  expect(first.getAttribute('aria-invalid')).toBe('true');
  view.rerender(
    <>
      <p id="help">Descripción existente.</p>
      <AssignmentField id="one" label="Primero" aria-describedby="help" />
    </>,
  );
  expect(
    screen
      .getByRole('textbox', { name: 'Primero', description: 'Descripción existente.' })
      .getAttribute('aria-invalid'),
  ).toBe('false');
  expect(screen.getByLabelText('Primero').getAttribute('aria-describedby')).toBe('help');
});

function pickerSession(pending = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/auth/me')
        return Response.json({
          id: 'synthetic',
          username: 'synthetic',
          fullName: 'Synthetic',
          role: 'ADMIN',
          permissions: ['observers:read'],
          mustChangePassword: false,
        });
      if (pending) return new Promise<Response>(() => {});
      return Response.json({ items: [], page: 1, pageSize: 20, total: 0 });
    }),
  );
}

it('uses distinct resource IDs, keeps descriptions, and associates both search and selection errors', async () => {
  pickerSession();
  render(
    <AppProviders>
      <p id="help">Contexto del recurso.</p>
      <ResourcePicker
        kind="observer"
        value=""
        onChange={() => {}}
        error="Selecciona primero."
        aria-describedby="help"
      />
      <ResourcePicker
        kind="observer"
        value=""
        onChange={() => {}}
        error="Selecciona segundo."
        aria-describedby="help"
      />
    </AppProviders>,
  );
  const first = await screen.findByRole('combobox', {
    description: 'Contexto del recurso. Selecciona primero.',
  });
  const second = screen.getByRole('combobox', {
    description: 'Contexto del recurso. Selecciona segundo.',
  });
  expect(first.id).not.toBe(second.id);
  const errorId = first.getAttribute('aria-describedby')!.split(' ')[1];
  expect(errorId).not.toBe(second.getAttribute('aria-describedby')!.split(' ')[1]);
  fireEvent.change(screen.getAllByLabelText('Buscar observador')[0], {
    target: { value: 'x'.repeat(101) },
  });
  const search = await screen.findByRole('textbox', {
    description: 'Contexto del recurso. Selecciona primero. Máximo 100 caracteres de búsqueda.',
  });
  expect(search.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(errorId)?.textContent).toBe('Selecciona primero.');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('offers an associated invalid search control while resource choices are unresolved', async () => {
  pickerSession(true);
  render(
    <AppProviders>
      <ResourcePicker
        kind="observer"
        value=""
        onChange={() => {}}
        error="Selecciona un observador válido."
      />
    </AppProviders>,
  );
  const search = await screen.findByRole('textbox', {
    name: 'Buscar observador',
    description: 'Selecciona un observador válido.',
  });
  expect(search.getAttribute('aria-invalid')).toBe('true');
  expect(screen.queryByRole('combobox')).toBeNull();
});

it.each([false, true])(
  'waits for asynchronous validation and preserves subsequent focus intent (%s)',
  async (moved) => {
    type Values = { first: string; second: string };
    let resolve!: (result: ResolverResult<Values>) => void;
    function Form() {
      const { formRef, prepareInvalidFocus } = useInvalidFieldFocus();
      const {
        register,
        handleSubmit,
        formState: { errors },
      } = useForm<Values>({
        shouldFocusError: false,
        resolver: () =>
          new Promise((done) => {
            resolve = done;
          }),
      });
      return (
        <>
          <form
            ref={formRef}
            onSubmit={(event) => void handleSubmit(vi.fn(), prepareInvalidFocus())(event)}
          >
            <AssignmentField
              id="first"
              label="Primero"
              {...register('first')}
              error={errors.first?.message}
            />
            <AssignmentField
              id="second"
              label="Segundo"
              {...register('second')}
              error={errors.second?.message}
            />
            <button>Validar</button>
          </form>
          <button>Otra acción</button>
        </>
      );
    }
    render(<Form />);
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }));
    const other = screen.getByRole('button', { name: 'Otra acción' });
    if (moved) other.focus();
    await act(async () =>
      resolve({
        values: {},
        errors: {
          second: { type: 'required', message: 'Segundo error.' },
          first: { type: 'required', message: 'Primer error.' },
        },
      }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(moved ? other : screen.getByLabelText('Primero')),
    );
  },
);
