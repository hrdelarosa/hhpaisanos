import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Link, useLocation } from 'react-router';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { administrativeAttendanceKey, listAdministrativeAttendance } from '../api/administration';
import { administrativeFiltersSchema } from '../schemas/administration';
import { AdministrativeMarkCard } from '../components/AdministrativeMarkCard';
import { reviewLabels } from '../components/AttendanceDayCard';
import { administrativeAttendanceError } from '../utils/administration';
import { useSession } from '../../auth/hooks/use-session';

export function AdministrativeAttendanceListPage() {
  const { user } = useSession();
  const [filters, setFilters] = useQueryStates(
    {
      operativeId: parseAsString.withDefault(''),
      observerId: parseAsString.withDefault(''),
      moduleId: parseAsString.withDefault(''),
      from: parseAsString.withDefault(''),
      to: parseAsString.withDefault(''),
      reviewStatus: parseAsString.withDefault(''),
      anomaly: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      limit: parseAsInteger.withDefault(20),
    },
    { history: 'push', shallow: false },
  );
  const { search } = useLocation();
  const parsed = administrativeFiltersSchema.safeParse(filters);
  const query = useQuery({
    queryKey: [...administrativeAttendanceKey, 'list', filters],
    queryFn: ({ signal }) =>
      listAdministrativeAttendance(administrativeFiltersSchema.parse(filters), signal),
    enabled: parsed.success,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-heading">Asistencias administrativas</h1>
      {user?.permissions.includes('attendance:capture-manual') && (
        <Link
          className="inline-flex min-h-touch items-center text-primary underline"
          to="/asistencias/manual"
        >
          Crear captura manual
        </Link>
      )}
      <p>
        Registros vigentes, ordenados por fecha descendente. La captura y la decisión administrativa
        son independientes.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ['operativeId', 'Identificador del operativo'],
            ['observerId', 'Identificador del observador'],
            ['moduleId', 'Identificador del módulo'],
            ['from', 'Desde'],
            ['to', 'Hasta'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="space-y-2" htmlFor={`attendance-${key}`}>
            {label}
            <Input
              id={`attendance-${key}`}
              type={key.endsWith('Id') ? 'text' : 'date'}
              value={filters[key]}
              onChange={(e) => void setFilters({ [key]: e.target.value, page: 1 })}
            />
          </label>
        ))}
        <label className="space-y-2" htmlFor="attendance-status">
          Estado de revisión
          <select
            id="attendance-status"
            className="min-h-touch w-full rounded-md border border-input bg-card px-3"
            value={filters.reviewStatus}
            onChange={(e) => void setFilters({ reviewStatus: e.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            {Object.entries(reviewLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2" htmlFor="attendance-anomaly">
          Anomalía
          <select
            id="attendance-anomaly"
            className="min-h-touch w-full rounded-md border border-input bg-card px-3"
            value={filters.anomaly}
            onChange={(e) => void setFilters({ anomaly: e.target.value, page: 1 })}
          >
            <option value="">Todas</option>
            <option value="late_arrival">Llegada tardía</option>
            <option value="early_departure">Salida temprana</option>
            <option value="missing_location">Sin ubicación</option>
          </select>
        </label>
        <label className="space-y-2" htmlFor="attendance-limit">
          Registros por página
          <Input
            id="attendance-limit"
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
            operativeId: null,
            observerId: null,
            moduleId: null,
            from: null,
            to: null,
            reviewStatus: null,
            anomaly: null,
            page: 1,
            limit: 20,
          })
        }
      >
        Limpiar filtros
      </Button>
      {!parsed.success ? (
        <p role="alert">
          Filtros inválidos: usa UUIDv7, fechas e intervalo válidos, página positiva y límite de 1 a
          100.
        </p>
      ) : query.isPending ? (
        <output>Cargando asistencias.</output>
      ) : query.isError ? (
        <div role="alert">
          <p>{administrativeAttendanceError(query.error)}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {!query.data.items.length ? (
            <output>No hay registros para esta página y filtros. Esto no implica ausencia.</output>
          ) : (
            <ul className="space-y-4">
              {query.data.items.map((mark) => (
                <li key={mark.id}>
                  <AdministrativeMarkCard mark={mark} />
                  <Link
                    className="inline-flex min-h-touch items-center text-primary underline"
                    to={`/asistencias/${mark.id}${search}`}
                  >
                    Ver detalle de {mark.type} · {mark.observerName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="Paginación de asistencias" className="flex flex-wrap items-center gap-4">
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
