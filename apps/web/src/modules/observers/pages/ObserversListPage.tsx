import { useQuery } from '@tanstack/react-query';
import { createParser, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { Link, useLocation } from 'react-router';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { listObservers, observersKey } from '../api/observers';
import { observerError } from '../utils/feedback';

function positiveInteger(max: number) {
  return createParser({
    parse: (value) =>
      /^\d{1,8}$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null,
    serialize: String,
  });
}
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
    <div className="space-y-4">
      <h1 className="text-heading">Observadores</h1>
      <p>
        Perfiles independientes de cuentas y asignaciones. Orden: creación e identificador
        ascendentes.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-2" htmlFor="observer-search">
          Buscar por nombres o apellidos
          <Input
            id="observer-search"
            value={filters.search}
            onChange={(event) => void setFilters({ search: event.target.value, page: 1 })}
          />
        </label>
        {(['active', 'linked'] as const).map((key) => (
          <div className="space-y-2" key={key}>
            <label htmlFor={`observer-${key}`}>
              {key === 'active' ? 'Estado' : 'Vinculación de cuenta'}
            </label>
            <select
              id={`observer-${key}`}
              className="flex min-h-touch w-full rounded-md border border-input bg-card px-3 text-body focus-visible:outline-2 focus-visible:outline-ring"
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
        <div className="space-y-2">
          <label htmlFor="observer-pageSize">Registros por página</label>
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
        </div>
      </div>
      <Button
        variant="secondary"
        onClick={() => void setFilters({ search: null, active: null, linked: null, page: 1 })}
      >
        Limpiar filtros
      </Button>
      {!valid ? (
        <p role="alert">La búsqueda admite hasta 200 caracteres.</p>
      ) : query.isPending ? (
        <output className="block">Cargando observadores…</output>
      ) : query.isError ? (
        <div role="alert" className="space-y-2">
          <p>{observerError(query.error)}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {query.data.items.length ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-left text-body-sm">
                <caption className="sr-only">Perfiles de observadores de Guerrero</caption>
                <thead>
                  <tr>
                    {['Nombres', 'Apellidos', 'Teléfono', 'Estado', 'Cuenta', 'Detalle'].map(
                      (label) => (
                        <th key={label} scope="col" className="p-4">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((observer) => (
                    <tr key={observer.id} className="border-t">
                      <th scope="row" className="p-4 font-medium whitespace-pre-wrap">
                        {observer.firstNames}
                      </th>
                      <td className="p-4 whitespace-pre-wrap">{observer.lastNames}</td>
                      <td className="p-4 whitespace-pre-wrap">
                        {observer.phone ?? 'Sin teléfono'}
                      </td>
                      <td className="p-4">{observer.active ? 'Activo' : 'Inactivo'}</td>
                      <td className="p-4">
                        {observer.userId ? 'Vinculada' : 'Sin cuenta vinculada'}
                      </td>
                      <td className="p-4">
                        <Link
                          className="inline-flex min-h-touch items-center text-primary underline"
                          aria-label={`Ver detalle de ${observer.firstNames} ${observer.lastNames}`}
                          to={`/observadores/${observer.id}${search}`}
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
              No hay observadores en esta página para los filtros seleccionados.
            </output>
          )}
          <nav
            aria-label="Paginación de observadores"
            className="flex flex-wrap items-center gap-4"
          >
            <Button
              variant="secondary"
              disabled={filters.page <= 1}
              onClick={() => void setFilters({ page: filters.page - 1 })}
            >
              Anterior
            </Button>
            <p className="tabular-nums">
              Página {query.data.page} de{' '}
              {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))} · {query.data.total}{' '}
              registros
            </p>
            <Button
              variant="secondary"
              disabled={
                filters.page >= 1000000 || filters.page * filters.pageSize >= query.data.total
              }
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
