import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { DataTable } from './data-table';
import { PaginationPage } from './pagination-page';

afterEach(cleanup);

const props = {
  columns: [
    {
      key: 'name',
      header: 'Nombre',
      rowHeader: true,
      render: (row: { id: string; name: string }) => row.name,
    },
  ],
  getRowKey: (row: { id: string }) => row.id,
  caption: 'Registros de prueba',
  regionLabel: 'Tabla de prueba',
  tableClassName: 'min-w-160',
  loadingMessage: 'Cargando registros…',
  emptyMessage: 'Sin registros.',
  errorMessage: 'No se pudo consultar.',
  renderActions: (row: { id: string }) => <a href={`/detalle/${row.id}`}>Ver detalle</a>,
  onRetry: vi.fn(),
};

it('keeps named keyboard scrolling, scoped headers, caption and row actions', () => {
  render(
    <DataTable
      {...props}
      data={[{ id: '1', name: 'Registro sintético' }]}
      isPending={false}
      isError={false}
      isSuccess
    />,
  );
  const region = screen.getByRole('region', { name: 'Tabla de prueba' });
  expect(region.tabIndex).toBe(0);
  expect(region.contains(screen.getByRole('table', { name: 'Registros de prueba' }))).toBe(true);
  expect(screen.getByRole('columnheader', { name: 'Nombre' }).getAttribute('scope')).toBe('col');
  expect(screen.getByRole('rowheader', { name: 'Registro sintético' }).getAttribute('scope')).toBe(
    'row',
  );
  expect(screen.getByRole('link', { name: 'Ver detalle' }).getAttribute('href')).toBe('/detalle/1');
});

it('announces loading and replaces skeletons with empty or retry feedback', () => {
  const { rerender } = render(
    <DataTable {...props} data={undefined} isPending isError={false} isSuccess={false} />,
  );
  expect(screen.getByRole('status').textContent).toBe('Cargando registros…');
  expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
  expect(screen.queryByRole('link')).toBeNull();
  rerender(<DataTable {...props} data={undefined} isPending={false} isError isSuccess={false} />);
  expect(screen.getByRole('alert').textContent).toContain('No se pudo consultar.');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(props.onRetry).toHaveBeenCalledOnce();
  rerender(<DataTable {...props} data={[]} isPending={false} isError={false} isSuccess />);
  expect(screen.getByRole('status').textContent).toBe('Sin registros.');
  expect(screen.queryByRole('button')).toBeNull();
});

it('keeps previous-page recovery when the current page is empty', () => {
  const previous = vi.fn();
  const next = vi.fn();
  render(
    <PaginationPage
      label="Paginación de prueba"
      page={2}
      total={0}
      limit={20}
      previousDisabled={false}
      nextDisabled
      onPreviousClick={previous}
      onNextClick={next}
    />,
  );
  expect(screen.getByText('Página 2 de 1 · 0 registros')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(previous).toHaveBeenCalledOnce();
  expect(next).not.toHaveBeenCalled();
});
