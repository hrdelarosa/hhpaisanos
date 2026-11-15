import { useQuery } from '@tanstack/react-query';
import { createParser, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { Link, useLocation } from 'react-router';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { listOperatives, operativesKey } from '../api/operatives';
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
export function OperativesListPage() {
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
    <div className="space-y-4">
      <h1 className="text-heading">Operativos</h1>
      <p>Orden: fecha inicial descendente y, en caso de empate, identificador descendente.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2" htmlFor="operative-search">
          Nombre
          <Input
            id="operative-search"
            value={filters.name}
            onChange={(event) => void setFilters({ name: event.target.value, page: 1 })}
          />
        </label>
        <div className="space-y-2">
          <label htmlFor="operative-status">Estado</label>
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
        <label className="space-y-2" htmlFor="operative-limit">
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
      {!valid ? (
        <p role="alert">El nombre admite hasta 120 caracteres.</p>
      ) : query.isPending ? (
        <output className="block">Cargando operativos…</output>
      ) : query.isError ? (
        <div role="alert" className="space-y-2">
          <p>{operativeError(query.error)}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {query.data.items.length ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-left text-body-sm">
                <caption className="sr-only">Operativos de Guerrero</caption>
                <thead>
                  <tr>
                    {['Nombre', 'Inicio', 'Fin', 'Estado', 'Contexto'].map((label) => (
                      <th key={label} scope="col" className="p-4">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((operative) => (
                    <tr key={operative.id} className="border-t">
                      <th scope="row" className="p-4 font-medium">
                        {operative.name}
                      </th>
                      <td className="p-4 tabular-nums">
                        <time>{operative.startDate}</time>
                      </td>
                      <td className="p-4 tabular-nums">
                        <time>{operative.endDate}</time>
                      </td>
                      <td className="p-4">{statusLabels[operative.status]}</td>
                      <td className="p-4">
                        <Link
                          className="inline-flex min-h-touch items-center text-primary underline"
                          aria-label={`Ver detalle de ${operative.name}`}
                          to={`/operativos/${operative.id}${search}`}
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <output className="block">
              No hay operativos en esta página para los filtros seleccionados.
            </output>
          )}
          <nav aria-label="Paginación de operativos" className="flex flex-wrap items-center gap-4">
            <Button
              variant="secondary"
              disabled={filters.page <= 1}
              onClick={() => void setFilters({ page: filters.page - 1 })}
            >
              Anterior
            </Button>
            <p className="tabular-nums">
              Página {query.data.page} de{' '}
              {Math.max(1, Math.ceil(query.data.total / query.data.limit))} · {query.data.total}{' '}
              registros
            </p>
            <Button
              variant="secondary"
              disabled={filters.page * filters.limit >= query.data.total}
              onClick={() => void setFilters({ page: filters.page + 1 })}
            >
              Siguiente
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}
