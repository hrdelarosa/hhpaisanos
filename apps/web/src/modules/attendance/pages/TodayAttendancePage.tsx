import { useQuery } from '@tanstack/react-query';
import { getToday } from '../api/attendance';
import { AttendanceDayCard } from '../components/AttendanceDayCard';
import { AttendanceError } from '../components/AttendanceError';
import { CaptureActions } from '../components/CaptureActions';
import { CaptureFeedback } from '../components/CaptureFeedback';
import { PageHeader } from '../../../components/page-header';

export function TodayAttendancePage() {
  const query = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: ({ signal }) => getToday(signal),
    // Today's server civil date must be reread when revisiting this route.
    staleTime: 0,
  });
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Mi asistencia de hoy"
        description="Consulta tus marcas y el siguiente paso disponible para cada asignación."
      />
      <p className="rounded-md border border-info bg-info-surface p-4 text-body-sm text-info">
        Si recargaste o cerraste esta página tras un envío incierto, consulta las marcas actuales.
        La recarga pierde el intento en memoria y no recupera su recibo exacto.
      </p>
      <CaptureFeedback />
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
              <AttendanceDayCard key={day.assignmentId} day={day}>
                <CaptureActions day={day} refreshing={query.isFetching} />
              </AttendanceDayCard>
            ))
          ) : (
            <output className="block">No tienes una asignación elegible para hoy.</output>
          )}
        </>
      )}
    </div>
  );
}
