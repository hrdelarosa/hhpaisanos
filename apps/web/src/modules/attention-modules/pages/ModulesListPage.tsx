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
import { listModules, modulesKey } from '../api/attention-modules';
import type { AttentionModule } from '../schemas/attention-modules';
import { moduleError } from '../utils/feedback';

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

const columns: DataTableColumn<AttentionModule>[] = [
  {
    key: 'name',
    header: 'Nombre',
    rowHeader: true,
    cellClassName: 'min-w-48',
    render: (module) => module.name,
  },
  {
    key: 'municipality',
    header: 'Municipio',
    cellClassName: 'min-w-40',
    render: (module) => module.municipality,
  },
  {
    key: 'active',
    header: 'Estado',
    render: (module) => (
      <StatusBadge
        label={module.active ? 'Activo' : 'Inactivo'}
        tone={module.active ? 'success' : 'neutral'}
      />
    ),
  },
];

export function ModulesListPage() {
  const { user } = useSession();
  const [filters, setFilters] = useQueryStates(
    {
      name: parseAsString.withDefault(''),
      municipality: parseAsString.withDefault(''),
      active: parseAsStringEnum<string>(['', 'true', 'false']).withDefault(''),
      page: positiveInteger(Math.floor(Number.MAX_SAFE_INTEGER / 100)).withDefault(1),
      limit: positiveInteger(100).withDefault(20),
    },
    { history: 'push' },
  );
  const { search } = useLocation();
  const valid =
    Array.from(filters.name).length <= 120 && Array.from(filters.municipality).length <= 100;
  const query = useQuery({
    queryKey: [...modulesKey, 'list', filters],
    queryFn: ({ signal }) => listModules(filters, signal),
    enabled: valid,
  });
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Módulos de atención"
        description="Consulta los puntos de atención, su municipio y disponibilidad."
        actions={
          user?.permissions.includes('attention-modules:create') && (
            <Link
              className="inline-flex min-h-touch items-center justify-center rounded-md bg-primary px-4 py-2 text-label text-primary-foreground hover:bg-primary-hover"
              to="/modulos/nuevo"
            >
              Crear módulo
            </Link>
          )
        }
      />
      <section aria-label="Filtros de módulos de atención" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-2 text-label" htmlFor="module-search">
            Nombre
            <Input
              id="module-search"
              value={filters.name}
              onChange={(event) => void setFilters({ name: event.target.value, page: 1 })}
            />
          </label>
          <label className="block space-y-2 text-label" htmlFor="municipality-search">
            Municipio (coincidencia exacta)
            <Input
              id="municipality-search"
              value={filters.municipality}
              onChange={(event) => void setFilters({ municipality: event.target.value, page: 1 })}
            />
          </label>
          <div className="space-y-2">
            <label className="text-label" htmlFor="module-active">
              Estado
            </label>
            <select
              id="module-active"
              className="flex min-h-touch w-full rounded-md border border-input bg-card px-3 text-body focus-visible:outline-2 focus-visible:outline-ring"
              value={filters.active}
              onChange={(event) => void setFilters({ active: event.target.value, page: 1 })}
            >
              <option value="">Todos</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-label" htmlFor="module-limit">
              Registros por página
            </label>
            <Input
              id="module-limit"
              aria-describedby="module-limit-help"
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
            <span id="module-limit-help" className="block text-body-sm text-foreground-secondary">
              Entre 1 y 100 registros.
            </span>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => void setFilters({ name: null, municipality: null, active: null, page: 1 })}
        >
          Limpiar filtros
        </Button>
      </section>
      <p className="text-body-sm text-muted-foreground">
        Orden: creación descendente y, en caso de empate, identificador descendente.
      </p>
      {!valid ? (
        <p role="alert">El nombre admite hasta 120 caracteres y el municipio hasta 100.</p>
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items}
          isPending={query.isPending}
          isError={query.isError}
          isSuccess={query.isSuccess}
          onRetry={() => void query.refetch()}
          getRowKey={(module) => module.id}
          caption="Módulos de atención de Guerrero"
          regionLabel="Tabla de módulos de atención"
          tableClassName="min-w-144"
          loadingMessage="Cargando módulos…"
          emptyMessage="No hay módulos en esta página para los filtros seleccionados."
          errorMessage={query.isError ? moduleError(query.error) : ''}
          renderActions={(module) => (
            <Link
              className="inline-flex min-h-touch items-center text-primary underline underline-offset-4"
              aria-label={`Ver detalle de ${module.name}`}
              to={`/modulos/${module.id}${search}`}
            >
              Ver detalle
            </Link>
          )}
        />
      )}
      {valid && query.isSuccess && (
        <PaginationPage
          label="Paginación de módulos"
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
