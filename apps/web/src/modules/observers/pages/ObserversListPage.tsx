import { useQuery } from '@tanstack/react-query';
import { createParser, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { Link, useLocation } from 'react-router';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { PageHeader } from '../../../components/page-header';
import { PaginationPage } from '../../../components/pagination-page';
import { StatusBadge } from '../../../components/status-badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { listObservers, observersKey } from '../api/observers';
import type { Observer } from '../schemas/observers';
import { observerError } from '../utils/feedback';

function positiveInteger(max: number) {
  return createParser({
    parse: (value) =>
      /^\d{1,8}$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null,
    serialize: String,
  });
}

const columns: DataTableColumn<Observer>[] = [
  {
    key: 'firstNames',
    header: 'Nombres',
    rowHeader: true,
    cellClassName: 'min-w-40 whitespace-pre-wrap',
    render: (observer) => observer.firstNames,
  },
  {
    key: 'lastNames',
    header: 'Apellidos',
    cellClassName: 'min-w-40 whitespace-pre-wrap',
    render: (observer) => observer.lastNames,
  },
  {
    key: 'phone',
    header: 'Teléfono',
    cellClassName: 'min-w-32 whitespace-pre-wrap',
    render: (observer) => observer.phone ?? 'Sin teléfono',
  },
  {
    key: 'active',
    header: 'Estado',
    render: (observer) => (
      <StatusBadge
        label={observer.active ? 'Activo' : 'Inactivo'}
        tone={observer.active ? 'success' : 'neutral'}
      />
    ),
  },
  {
    key: 'linked',
    header: 'Cuenta',
    render: (observer) => (
      <StatusBadge
        label={observer.userId ? 'Vinculada' : 'Sin cuenta'}
        tone={observer.userId ? 'success' : 'neutral'}
      />
    ),
  },
];

export function ObserversListPage() {
  const [filters, setFilters] = useQueryStates(
    {
      search: parseAsString.withDefault(''),
      active: parseAsStringEnum<string>(['', 'true', 'false']).withDefault(''),
      linked: parseAsStringEnum<string>(['', 'true', 'false']).withDefault(''),
      page: positiveInteger(1000000).withDefault(1),
      pageSize: positiveInteger(100).withDefault(20),
    },
    { history: 'push' },
  );
  const { search } = useLocation();
  const valid = Array.from(filters.search).length <= 200;
  const query = useQuery({
    queryKey: [...observersKey, 'list', filters],
    queryFn: ({ signal }) => listObservers(filters, signal),
    enabled: valid,
  });
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Observadores"
        description="Perfiles independientes de cuentas y asignaciones. Orden: creación e identificador ascendentes."
      />
      <section aria-label="Filtros de observadores" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-2 text-label" htmlFor="observer-search">
            Buscar por nombres o apellidos
            <Input
              id="observer-search"
              value={filters.search}
              onChange={(event) => void setFilters({ search: event.target.value, page: 1 })}
            />
          </label>
          {(['active', 'linked'] as const).map((key) => (
            <div className="space-y-2" key={key}>
              <label className="text-label" htmlFor={`observer-${key}`}>
                {key === 'active' ? 'Estado' : 'Vinculación de cuenta'}
              </label>
              <select
                id={`observer-${key}`}
                className="min-h-touch w-full rounded-md border border-input bg-card px-3"
                value={filters[key]}
                onChange={(event) => void setFilters({ [key]: event.target.value, page: 1 })}
              >
                <option value="">Todos</option>
                <option value="true">{key === 'active' ? 'Activo' : 'Con cuenta vinculada'}</option>
                <option value="false">
                  {key === 'active' ? 'Inactivo' : 'Sin cuenta vinculada'}
                </option>
              </select>
            </div>
          ))}
          <label className="block space-y-2 text-label" htmlFor="observer-pageSize">
            Registros por página
            <Input
              id="observer-pageSize"
              type="number"
              min={1}
              max={100}
              value={filters.pageSize}
              onChange={(event) => {
                const pageSize = Number(event.target.value);
                if (Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100)
                  void setFilters({ pageSize, page: 1 });
              }}
            />
          </label>
        </div>
        <Button
          variant="secondary"
          onClick={() => void setFilters({ search: null, active: null, linked: null, page: 1 })}
        >
          Limpiar filtros
        </Button>
      </section>
      {!valid ? (
        <p role="alert">La búsqueda admite hasta 200 caracteres.</p>
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items}
          isPending={query.isPending}
          isError={query.isError}
          isSuccess={query.isSuccess}
          onRetry={() => void query.refetch()}
          getRowKey={(observer) => observer.id}
          caption="Perfiles de observadores de Guerrero"
          regionLabel="Tabla de observadores"
          tableClassName="min-w-200"
          loadingMessage="Cargando observadores…"
          emptyMessage="No hay observadores en esta página para los filtros seleccionados."
          errorMessage={query.isError ? observerError(query.error) : ''}
          renderActions={(observer) => (
            <Link
              className="inline-flex min-h-touch items-center text-primary underline underline-offset-4"
              aria-label={`Ver detalle de ${observer.firstNames} ${observer.lastNames}`}
              to={`/observadores/${observer.id}${search}`}
            >
              Ver detalle
            </Link>
          )}
        />
      )}
      {valid && query.isSuccess && (
        <PaginationPage
          label="Paginación de observadores"
          page={query.data.page}
          total={query.data.total}
          limit={query.data.pageSize}
          previousDisabled={filters.page <= 1}
          nextDisabled={
            filters.page >= 1000000 || filters.page * filters.pageSize >= query.data.total
          }
          onPreviousClick={() => void setFilters({ page: filters.page - 1 })}
          onNextClick={() => void setFilters({ page: filters.page + 1 })}
        />
      )}
    </div>
  );
}
