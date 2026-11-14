import { useQuery } from '@tanstack/react-query';
import { createParser, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { getHistory } from '../api/attendance';
import { AttendanceDayCard } from '../components/AttendanceDayCard';
import { AttendanceError } from '../components/AttendanceError';
import { civilDateSchema } from '../schemas/attendance';

function boundedInteger(max: number) {
  return createParser({
    parse: (value) => {
      const number = parseAsInteger.parse(value);
      return /^\d+$/.test(value) && number !== null && number >= 1 && number <= max ? number : null;
    },
    serialize: String,
  });
}

export function AttendanceHistoryPage() {
  const [filters, setFilters] = useQueryStates(
    {
      from: parseAsString.withDefault(''),
      to: parseAsString.withDefault(''),
      page: boundedInteger(1_000_000).withDefault(1),
      limit: boundedInteger(100).withDefault(20),
    },
    { history: 'push' },
  );
  const valid =
    (!filters.from || civilDateSchema.safeParse(filters.from).success) &&
    (!filters.to || civilDateSchema.safeParse(filters.to).success) &&
    (!filters.from || !filters.to || filters.from <= filters.to);
  const query = useQuery({
    queryKey: ['attendance', 'history', filters],
    queryFn: ({ signal }) => getHistory(filters, signal),
    enabled: valid,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-heading">Historial de mi asistencia</h1>
      <p>
        Solo se muestran fechas con marcas registradas. Las anomalías se conservan aunque la
        revisión las acepte.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label htmlFor="attendance-from" className="space-y-2">
          Desde
          <Input
            id="attendance-from"
            type="date"
            min="1000-01-01"
            max="9999-12-31"
            value={filters.from}
            onChange={(event) => void setFilters({ from: event.target.value, page: 1 })}
          />
        </label>
        <label htmlFor="attendance-to" className="space-y-2">
          Hasta
          <Input
            id="attendance-to"
            type="date"
            min="1000-01-01"
            max="9999-12-31"
            value={filters.to}
            onChange={(event) => void setFilters({ to: event.target.value, page: 1 })}
          />
        </label>
        <label htmlFor="attendance-limit" className="space-y-2">
          Registros por página
          <Input
            id="attendance-limit"
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
        onClick={() => void setFilters({ from: null, to: null, page: 1 })}
      >
        Limpiar fechas
      </Button>
      {!valid ? (
        <p role="alert">
          Usa fechas válidas entre 1000 y 9999 y un intervalo donde Desde no sea posterior a Hasta.
        </p>
      ) : query.isPending ? (
        <output className="block">Cargando historial…</output>
      ) : query.isError ? (
        <AttendanceError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.items.length ? (
            query.data.items.map((day) => (
              <AttendanceDayCard key={`${day.assignmentId}-${day.date}`} day={day} />
            ))
          ) : (
            <output className="block">
              No hay registros en esta página para las fechas seleccionadas.
            </output>
          )}
          <nav aria-label="Paginación del historial" className="flex flex-wrap items-center gap-4">
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
              disabled={
                filters.page >= 1_000_000 || filters.page * query.data.limit >= query.data.total
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
