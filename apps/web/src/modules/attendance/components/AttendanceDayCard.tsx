import type { AttendanceDay, AttendanceMark } from '../schemas/attendance';

const reviewLabels = {
  accepted_automatic: 'Aceptada automáticamente',
  pending_review: 'Pendiente de revisión',
  accepted_administrative: 'Aceptada administrativamente',
  rejected: 'Rechazada',
  annulled: 'Anulada',
};
const reviewStyles = {
  accepted_automatic: 'bg-info-surface text-info',
  pending_review: 'bg-warning-surface text-warning',
  accepted_administrative: 'bg-info-surface text-info',
  rejected: 'bg-danger-surface text-destructive',
  annulled: 'bg-danger-surface text-destructive',
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

function Mark({ label, mark }: { label: string; mark: AttendanceMark | null }) {
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
            <span
              className={`inline-block rounded-full px-3 py-1 text-label ${reviewStyles[mark.reviewStatus]}`}
            >
              {reviewLabels[mark.reviewStatus]}
            </span>
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

export function AttendanceDayCard({ day }: { day: AttendanceDay }) {
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Mark label="Entrada" mark={day.checkIn} />
        <Mark label="Salida" mark={day.checkOut} />
      </div>
    </article>
  );
}
