import type { ReactNode } from 'react';
import { StatusBadge } from '../../../components/status-badge';
import type { AttendanceDay, AttendanceMark } from '../schemas/attendance';

export const reviewLabels = {
  accepted_automatic: 'Aceptada automáticamente',
  pending_review: 'Pendiente de revisión',
  accepted_administrative: 'Aceptada administrativamente',
  rejected: 'Rechazada',
  annulled: 'Anulada',
};
const anomalyLabels = {
  late_arrival: 'Llegada tardía',
  early_departure: 'Salida temprana',
  missing_location: 'Sin ubicación',
};
const completenessLabels = {
  none: 'Sin marcas',
  check_in_only: 'Solo entrada registrada',
  check_out_only: 'Solo salida registrada',
  complete: 'Entrada y salida registradas',
};

export function AttendanceMarkView({
  label,
  mark,
}: {
  label: string;
  mark: AttendanceMark | null;
}) {
  return (
    <section className="min-w-0 space-y-2 rounded-md bg-muted p-4">
      <h3 className="text-subheading">{label}</h3>
      {mark ? (
        <>
          <p className="break-words tabular-nums">
            Hora oficial (UTC):{' '}
            <time dateTime={mark.officialTimestamp}>{mark.officialTimestamp}</time>
          </p>
          <p>Versión {mark.version}</p>
          <p>
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
          </p>
          <h4 className="font-medium">Anomalías calculadas</h4>
          {mark.anomalies.length ? (
            <ul className="list-inside list-disc">
              {mark.anomalies.map((anomaly) => (
                <li key={anomaly}>{anomalyLabels[anomaly]}</li>
              ))}
            </ul>
          ) : (
            <p>Sin anomalías calculadas.</p>
          )}
        </>
      ) : (
        <p>Sin registro de {label.toLowerCase()}.</p>
      )}
    </section>
  );
}

export function AttendanceDayCard({ day, children }: { day: AttendanceDay; children?: ReactNode }) {
  return (
    <article className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground sm:p-6">
      <h2 className="text-heading-sm">
        <time dateTime={day.date}>{day.date}</time> · {day.operativeName}
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-foreground-secondary">Módulo de atención asignado</dt>
          <dd>{day.moduleName}</dd>
        </div>
        <div>
          <dt className="text-foreground-secondary">Horario programado (America/Mexico_City)</dt>
          <dd className="tabular-nums">
            Entrada {day.startTime} · Salida {day.endTime}
          </dd>
        </div>
        <div>
          <dt className="text-foreground-secondary">Completitud de captura</dt>
          <dd>{completenessLabels[day.completeness]}</dd>
        </div>
      </dl>
      {children}
      <div className="grid gap-4 lg:grid-cols-2">
        <AttendanceMarkView label="Entrada" mark={day.checkIn} />
        <AttendanceMarkView label="Salida" mark={day.checkOut} />
      </div>
    </article>
  );
}
