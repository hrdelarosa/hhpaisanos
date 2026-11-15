import { useQuery } from '@tanstack/react-query';
import { Button } from '../../../components/ui/button';
import { useSession } from '../../auth/hooks/use-session';
import { getHistory } from '../api/attendance';
import { AttendanceMarkView, reviewLabels } from './AttendanceDayCard';
import { useCapture } from './CaptureProvider';

export function CaptureFeedback() {
  const { state, retry } = useCapture();
  const { user } = useSession();
  const filters = { from: state.date ?? '', to: state.date ?? '', page: 1, limit: 100 };
  const query = useQuery({
    queryKey: ['attendance', 'history', filters],
    queryFn: ({ signal }) => getHistory(filters, signal),
    enabled: state.phase === 'success',
    staleTime: 0,
  });
  if (state.phase === 'idle') return null;
  const recoverable = ['uncertain', 'authorization', 'conflict'].includes(state.phase);
  const day = query.data?.items.find((item) => item.assignmentId === state.assignmentId);
  const mark = state.operation === 'check-in' ? day?.checkIn : day?.checkOut;
  return (
    <section
      aria-label="Resultado de captura"
      className="space-y-4 rounded-lg border bg-card p-4 sm:p-6"
    >
      {['locating', 'submitting'].includes(state.phase) ? (
        <output className="block">{state.message}</output>
      ) : (
        <p role={state.phase === 'success' ? 'status' : 'alert'}>{state.message}</p>
      )}
      {state.date && (
        <p>
          Solicitud de {state.operation === 'check-in' ? 'entrada' : 'salida'} para la fecha civil{' '}
          {state.date}.
        </p>
      )}
      {recoverable && (
        <Button
          variant="secondary"
          disabled={!user?.permissions.includes('attendance:capture-own')}
          onClick={() => void retry()}
        >
          Reintentar la misma solicitud
        </Button>
      )}
      {state.result && (
        <>
          <p>Estado original confirmado: {reviewLabels[state.result.state]}.</p>
          {query.isPending ? (
            <output className="block">Consultando el registro vigente y sus anomalías…</output>
          ) : query.isError ? (
            <div role="alert" className="space-y-2">
              <p>
                La captura fue confirmada, pero no se pudo consultar su detalle vigente. No vuelvas
                a capturar por este error de lectura.
              </p>
              <Button variant="secondary" onClick={() => void query.refetch()}>
                Reconsultar detalle
              </Button>
            </div>
          ) : mark ? (
            <AttendanceMarkView label="Registro vigente de la captura" mark={mark} />
          ) : (
            <p>
              La captura fue confirmada, pero su registro vigente no aparece en esta consulta.
              Consulta el historial; no se ha inferido una nueva marca.
            </p>
          )}
        </>
      )}
    </section>
  );
}
