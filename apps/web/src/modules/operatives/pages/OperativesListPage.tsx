import { useQuery } from '@tanstack/react-query';
import { createParser, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { Link, useLocation } from 'react-router';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { PageHeader } from '../../../components/page-header';
import { PaginationPage } from '../../../components/pagination-page';
import { StatusBadge } from '../../../components/status-badge';
import { useSession } from '../../auth/hooks/use-session';
import { listOperatives, operativesKey } from '../api/operatives';
import type { Operative } from '../schemas/operatives';
import { operativeError, statusLabels } from '../utils/feedback';

function positiveInteger(max: number) {
  return createParser({
    parse: (value) =>
      /^\d+$/.test(value) &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) >= 1 &&
      Number(value) <= max
        ? Number(value)
        : null,
    serialize: String,
  });
}

const columns: DataTableColumn<Operative>[] = [
  {
    key: 'name',
    header: 'Nombre',
    rowHeader: true,
    cellClassName: 'min-w-48',
    render: (operative) => operative.name,
  },
  {
    key: 'start',
    header: 'Inicio',
    cellClassName: 'tabular-nums whitespace-nowrap',
    render: (operative) => <time>{operative.startDate}</time>,
  },
  {
    key: 'end',
    header: 'Fin',
    cellClassName: 'tabular-nums whitespace-nowrap',
    render: (operative) => <time>{operative.endDate}</time>,
  },
  {
    key: 'status',
    header: 'Estado',
    render: (operative) => (
      <StatusBadge
        label={statusLabels[operative.status]}
        tone={
          operative.status === 'activo'
            ? 'success'
            : operative.status === 'borrador'
              ? 'warning'
              : 'neutral'
        }
      />
    ),
  },
];

export function OperativesListPage() {
  const { user } = useSession();
  const [filters, setFilters] = useQueryStates(
    {
      name: parseAsString.withDefault(''),
      status: parseAsStringEnum<string>(['', 'borrador', 'activo', 'cerrado']).withDefault(''),
      page: positiveInteger(Math.floor(Number.MAX_SAFE_INTEGER / 100)).withDefault(1),
      limit: positiveInteger(100).withDefault(20),
    },
    { history: 'push' },
  );
  const { search } = useLocation();
  const valid = Array.from(filters.name).length <= 120;
  const query = useQuery({
    queryKey: [...operativesKey, 'list', filters],
    queryFn: ({ signal }) => listOperatives(filters, signal),
    enabled: valid,
  });
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Operativos"
        description="Consulta los periodos de operación y su estado administrativo."
        actions={
          user?.permissions.includes('operatives:create') && (
            <Link
              className="inline-flex min-h-touch items-center justify-center rounded-md bg-primary px-4 py-2 text-label text-primary-foreground hover:bg-primary-hover"
              to="/operativos/nuevo"
            >
              Crear operativo
            </Link>
          )
        }
      />
      <section aria-label="Filtros de operativos" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-2 text-label" htmlFor="operative-search">
            Nombre
            <Input
              id="operative-search"
              value={filters.name}
              onChange={(event) => void setFilters({ name: event.target.value, page: 1 })}
            />
          </label>
          <div className="space-y-2">
            <label className="text-label" htmlFor="operative-status">
              Estado
            </label>
            <select
              id="operative-status"
              className="flex min-h-touch w-full rounded-md border border-input bg-card px-3 text-body focus-visible:outline-2 focus-visible:outline-ring"
              value={filters.status}
              onChange={(event) => void setFilters({ status: event.target.value, page: 1 })}
            >
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label className="block space-y-2 text-label" htmlFor="operative-limit">
            Registros por página
            <Input
              id="operative-limit"
              type="number"
              min={1}
              max={100}
              value={filters.limit}
              onChange={(event) => {
                const limit = Number(event.target.value);
                if (Number.isInteger(limit) && limit >= 1 && limit <= 100)
                  void setFilters({ limit, page: 1 });
              }}
            />
          </label>
        </div>
        <Button
          variant="secondary"
          onClick={() => void setFilters({ name: null, status: null, page: 1 })}
        >
          Limpiar filtros
        </Button>
      </section>
      <p className="text-body-sm text-muted-foreground">
        Orden: fecha inicial descendente y, en caso de empate, identificador descendente.
      </p>
      {!valid ? (
        <p role="alert">El nombre admite hasta 120 caracteres.</p>
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items}
          isPending={query.isPending}
          isError={query.isError}
          isSuccess={query.isSuccess}
          onRetry={() => void query.refetch()}
          getRowKey={(operative) => operative.id}
          caption="Operativos de Guerrero"
          regionLabel="Tabla de operativos"
          tableClassName="min-w-160"
          loadingMessage="Cargando operativos…"
          emptyMessage="No hay operativos en esta página para los filtros seleccionados."
          errorMessage={query.isError ? operativeError(query.error) : ''}
          renderActions={(operative) => (
            <Link
              className="inline-flex min-h-touch items-center text-primary underline underline-offset-4"
              aria-label={`Ver detalle de ${operative.name}`}
              to={`/operativos/${operative.id}${search}`}
            >
              Ver detalle
            </Link>
          )}
        />
      )}
      {valid && query.isSuccess && (
        <PaginationPage
          label="Paginación de operativos"
          page={query.data.page}
          total={query.data.total}
          limit={query.data.limit}
          previousDisabled={filters.page <= 1}
          nextDisabled={filters.page * filters.limit >= query.data.total}
          onPreviousClick={() => void setFilters({ page: filters.page - 1 })}
          onNextClick={() => void setFilters({ page: filters.page + 1 })}
        />
      )}
    </div>
  );
}
