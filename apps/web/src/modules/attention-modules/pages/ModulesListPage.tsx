import { useQuery } from '@tanstack/react-query';
import { createParser, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { Link, useLocation } from 'react-router';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { listModules, modulesKey } from '../api/attention-modules';
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
export function ModulesListPage() {
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
    <div className="space-y-4">
      <h1 className="text-heading">Módulos de atención</h1>
      <p>Orden: creación descendente y, en caso de empate, identificador descendente.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-2" htmlFor="module-search">
          Nombre
          <Input
            id="module-search"
            value={filters.name}
            onChange={(event) => void setFilters({ name: event.target.value, page: 1 })}
          />
        </label>
        <label className="space-y-2" htmlFor="municipality-search">
          Municipio (coincidencia exacta)
          <Input
            id="municipality-search"
            value={filters.municipality}
            onChange={(event) => void setFilters({ municipality: event.target.value, page: 1 })}
          />
        </label>
        <div className="space-y-2">
          <label htmlFor="module-active">Estado</label>
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
        <label className="space-y-2" htmlFor="module-limit">
          Registros por página
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
        </label>
      </div>
      <Button
        variant="secondary"
        onClick={() => void setFilters({ name: null, municipality: null, active: null, page: 1 })}
      >
        Limpiar filtros
      </Button>
      {!valid ? (
        <p role="alert">El nombre admite hasta 120 caracteres y el municipio hasta 100.</p>
      ) : query.isPending ? (
        <output className="block">Cargando módulos…</output>
      ) : query.isError ? (
        <div role="alert" className="space-y-2">
          <p>{moduleError(query.error)}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {query.data.items.length ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-left text-body-sm">
                <caption className="sr-only">Módulos de atención de Guerrero</caption>
                <thead>
                  <tr>
                    {['Nombre', 'Municipio', 'Estado', 'Detalle'].map((label) => (
                      <th key={label} scope="col" className="p-4">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((module) => (
                    <tr key={module.id} className="border-t">
                      <th scope="row" className="p-4 font-medium">
                        {module.name}
                      </th>
                      <td className="p-4">{module.municipality}</td>
                      <td className="p-4">{module.active ? 'Activo' : 'Inactivo'}</td>
                      <td className="p-4">
                        <Link
                          className="inline-flex min-h-touch items-center text-primary underline"
                          aria-label={`Ver detalle de ${module.name}`}
                          to={`/modulos/${module.id}${search}`}
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
              No hay módulos en esta página para los filtros seleccionados.
            </output>
          )}
          <nav aria-label="Paginación de módulos" className="flex flex-wrap items-center gap-4">
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
