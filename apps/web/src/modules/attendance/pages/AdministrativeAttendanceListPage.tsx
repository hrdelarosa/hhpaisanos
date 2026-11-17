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
import { PageHeader } from '../../../components/page-header';
import { PaginationPage } from '../../../components/pagination-page';

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
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Asistencias administrativas"
        description="Registros vigentes, ordenados por fecha descendente. La captura y la decisión administrativa son independientes."
        actions={
          user?.permissions.includes('attendance:capture-manual') && (
            <Link
              className="inline-flex min-h-touch items-center justify-center rounded-md bg-primary px-4 py-2 text-label text-primary-foreground hover:bg-primary-hover"
              to="/asistencias/manual"
            >
              Crear captura manual
            </Link>
          )
        }
      />
      <section aria-label="Filtros de asistencias" className="space-y-4">
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
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
      </section>
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
          <PaginationPage
            label="Paginación de asistencias"
            page={query.data.page}
            total={query.data.total}
            limit={query.data.limit}
            previousDisabled={filters.page <= 1}
            nextDisabled={filters.page * filters.limit >= query.data.total}
            onPreviousClick={() => void setFilters({ page: filters.page - 1 })}
            onNextClick={() => void setFilters({ page: filters.page + 1 })}
          />
        </>
      )}
    </div>
  );
}
