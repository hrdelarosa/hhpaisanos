import { Link } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';
import type { AdministrativeMark } from '../schemas/administration';
import { AttendanceMarkView, reviewLabels } from './AttendanceDayCard';
import { StatusBadge } from '../../../components/status-badge';

export function AdministrativeMarkCard({ mark }: { mark: AdministrativeMark }) {
  const { user } = useSession();
  return (
    <article className="min-w-0 space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h2 className="text-heading-sm">
          {mark.date} · {mark.observerName}
        </h2>
        <StatusBadge
          label={reviewLabels[mark.reviewStatus]}
          tone={
            mark.reviewStatus === 'pending_review'
              ? 'warning'
              : mark.reviewStatus === 'rejected' || mark.reviewStatus === 'annulled'
                ? 'danger'
                : 'info'
          }
        />
      </header>
      <p>
        Operativo: {mark.operativeName} · Módulo: {mark.moduleName}
      </p>
      <p className="break-all">
        Asignación:{' '}
        {user?.permissions.includes('assignments:read') ? (
          <Link className="text-primary underline" to={`/asignaciones/${mark.assignmentId}`}>
            {mark.assignmentId}
          </Link>
        ) : (
          mark.assignmentId
        )}
      </p>
      <p>
        Horario (America/Mexico_City): {mark.startTime} — {mark.endTime}
      </p>
      <p>
        Captura:{' '}
        {
          {
            none: 'Sin marcas vigentes',
            check_in_only: 'Solo entrada registrada',
            check_out_only: 'Solo salida registrada',
            complete: 'Entrada y salida registradas',
          }[mark.completeness]
        }
      </p>
      <p>
        Canal original: {mark.channel} · {mark.current ? 'Versión vigente' : 'Versión histórica'} ·
        Política {mark.policyVersion}
      </p>
      <AttendanceMarkView label={mark.type === 'entrada' ? 'Entrada' : 'Salida'} mark={mark} />
    </article>
  );
}
