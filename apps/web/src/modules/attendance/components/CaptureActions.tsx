import { Button } from '../../../components/ui/button';
import { useSession } from '../../auth/hooks/use-session';
import type { AttendanceDay } from '../schemas/attendance';
import { useCapture } from './CaptureProvider';

export function CaptureActions({ day, refreshing }: { day: AttendanceDay; refreshing: boolean }) {
  const { user } = useSession();
  const { state, start } = useCapture();
  if (user?.role !== 'OBSERVADOR' || !user.permissions.includes('attendance:capture-own'))
    return null;
  const operation =
    !day.checkIn && !day.checkOut
      ? 'check-in'
      : day.checkIn && !day.checkOut && !['rejected', 'annulled'].includes(day.checkIn.reviewStatus)
        ? 'check-out'
        : null;
  const blocked = ['locating', 'submitting', 'uncertain', 'authorization', 'conflict'].includes(
    state.phase,
  );
  return (
    <div className="space-y-4 rounded-md bg-secondary p-4 text-secondary-foreground">
      {operation ? (
        <>
          <p>
            Al registrar solicitaremos tu ubicación como evidencia no verificada. Si no está
            disponible, la captura puede continuar y requerirá revisión administrativa.
          </p>
          <Button
            disabled={blocked || refreshing}
            onClick={() => void start(operation, day.assignmentId, day.date)}
          >
            {operation === 'check-in' ? 'Registrar entrada' : 'Registrar salida'}
          </Button>
        </>
      ) : (
        <p>
          {day.checkIn &&
          ['rejected', 'annulled'].includes(day.checkIn.reviewStatus) &&
          !day.checkOut
            ? 'No puedes registrar salida con una entrada rechazada o anulada. Solicita revisión administrativa.'
            : 'No hay una captura personal disponible para este contexto.'}
        </p>
      )}
    </div>
  );
}
