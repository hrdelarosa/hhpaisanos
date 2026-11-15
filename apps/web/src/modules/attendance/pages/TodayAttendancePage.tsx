import { useQuery } from '@tanstack/react-query';
import { getToday } from '../api/attendance';
import { AttendanceDayCard } from '../components/AttendanceDayCard';
import { AttendanceError } from '../components/AttendanceError';

export function TodayAttendancePage() {
  const query = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: ({ signal }) => getToday(signal),
    // Today's server civil date must be reread when revisiting this route.
    staleTime: 0,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-heading">Mi asistencia de hoy</h1>
      {query.isPending ? (
        <output className="block">Cargando asistencia de hoy…</output>
      ) : query.isError ? (
        <AttendanceError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p>
            Fecha civil del servidor: <time dateTime={query.data.date}>{query.data.date}</time> ·
            Zona horaria: {query.data.timeZone}
          </p>
          {query.data.assignments.length ? (
            query.data.assignments.map((day) => (
              <AttendanceDayCard key={day.assignmentId} day={day} />
            ))
          ) : (
            <output className="block">No tienes una asignación elegible para hoy.</output>
          )}
        </>
      )}
    </div>
  );
}
