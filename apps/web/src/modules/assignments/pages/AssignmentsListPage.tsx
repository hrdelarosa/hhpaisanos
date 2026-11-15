import { useQuery } from '@tanstack/react-query';
import { parseAsString, parseAsInteger, useQueryStates } from 'nuqs';
import { Link, useLocation } from 'react-router';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { assignmentsKey, listAssignments } from '../api/assignments';
import { filterSchema } from '../schemas/assignments';
import { assignmentError, assignmentStatus } from '../utils/feedback';
import { ResourceName } from '../components/ResourcePicker';

export function AssignmentsListPage() {
  const [filters, setFilters] = useQueryStates(
    {
      observerId: parseAsString.withDefault(''),
      operativeId: parseAsString.withDefault(''),
      attentionModuleId: parseAsString.withDefault(''),
      applicableOn: parseAsString.withDefault(''),
      from: parseAsString.withDefault(''),
      to: parseAsString.withDefault(''),
      cancelled: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      limit: parseAsInteger.withDefault(20),
    },
    { history: 'push', shallow: false },
  );
  const { search } = useLocation();
  const parsed = filterSchema.safeParse(filters);
  const query = useQuery({
    queryKey: [...assignmentsKey, 'list', filters],
    queryFn: ({ signal }) => listAssignments(filterSchema.parse(filters), signal),
    enabled: parsed.success,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-heading">Asignaciones</h1>
      <p>
        Períodos inclusivos y horario de México. Orden por inicio e identificador. El estado por
        fechas es orientativo, no una autorización de asistencia.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ['observerId', 'Identificador del observador'],
            ['operativeId', 'Identificador del operativo'],
            ['attentionModuleId', 'Identificador del módulo'],
            ['applicableOn', 'Aplicable el día'],
            ['from', 'Períodos desde'],
            ['to', 'Períodos hasta'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="space-y-2" htmlFor={`filter-${key}`}>
            {label}
            <Input
              id={`filter-${key}`}
              type={key.endsWith('Id') ? 'text' : 'date'}
              value={filters[key]}
              onChange={(e) => void setFilters({ [key]: e.target.value, page: 1 })}
            />
          </label>
        ))}
        <label className="space-y-2" htmlFor="filter-cancelled">
          Cancelación
          <select
            id="filter-cancelled"
            className="min-h-touch w-full rounded-md border border-input bg-card px-3"
            value={filters.cancelled}
            onChange={(e) => void setFilters({ cancelled: e.target.value, page: 1 })}
          >
            <option value="">Todas</option>
            <option value="false">No canceladas</option>
            <option value="true">Canceladas</option>
          </select>
        </label>
        <label className="space-y-2" htmlFor="filter-limit">
          Registros por página
          <Input
            id="filter-limit"
            type="number"
            min={1}
            max={100}
            value={filters.limit}
            onChange={(e) => void setFilters({ limit: Number(e.target.value), page: 1 })}
          />
        </label>
      </div>
      <Button
        variant="secondary"
        onClick={() =>
          void setFilters({
            observerId: null,
            operativeId: null,
            attentionModuleId: null,
            applicableOn: null,
            from: null,
            to: null,
            cancelled: null,
            page: 1,
            limit: 20,
          })
        }
      >
        Limpiar filtros
      </Button>
      {!parsed.success ? (
        <p role="alert">
          Filtros inválidos: usa UUIDv7, fechas válidas y un intervalo ordenado; página positiva y
          límite de 1 a 100.
        </p>
      ) : query.isPending ? (
        <output>Cargando asignaciones.</output>
      ) : query.isError ? (
        <div role="alert">
          <p>{assignmentError(query.error)}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {!query.data.items.length ? (
            <output>No hay asignaciones para esta página y filtros.</output>
          ) : (
            <ul className="space-y-4">
              {query.data.items.map((item) => (
                <li key={item.id} className="space-y-2 rounded-lg border bg-card p-4 sm:p-6">
                  <p>
                    <strong>Observador: </strong>
                    <ResourceName kind="observer" id={item.observerId} />
                  </p>
                  <p>
                    <strong>Operativo: </strong>
                    <ResourceName kind="operative" id={item.operativeId} />
                  </p>
                  <p>
                    <strong>Módulo: </strong>
                    <ResourceName kind="module" id={item.attentionModuleId} />
                  </p>
                  <p className="tabular-nums">
                    {item.validFrom} — {item.validTo} · {item.startTime} — {item.endTime}
                  </p>
                  <p>
                    {assignmentStatus(item)} · Versión {item.version}
                  </p>
                  <Link
                    className="inline-flex min-h-touch items-center break-all text-primary underline"
                    to={`/asignaciones/${item.id}${search}`}
                  >
                    Ver asignación {item.id}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <nav
            aria-label="Paginación de asignaciones"
            className="flex flex-wrap items-center gap-4"
          >
            <Button
              variant="secondary"
              disabled={filters.page <= 1}
              onClick={() => void setFilters({ page: filters.page - 1 })}
            >
              Anterior
            </Button>
            <p>
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
