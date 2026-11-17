import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, useQueryState } from 'nuqs';
import { Link, useLocation, useParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import {
  administrativeAttendanceKey,
  administrativeDetailQuery,
  getAdministrativeHistory,
} from '../api/administration';
import { AdministrativeMarkCard } from '../components/AdministrativeMarkCard';
import { ReviewAttendance } from '../components/ReviewAttendance';
import { HistoricalAttendanceOperation } from '../components/HistoricalAttendanceOperation';
import { reviewLabels } from '../components/AttendanceDayCard';
import { administrativeAttendanceError } from '../utils/administration';
import { PageHeader } from '../../../components/page-header';
import { PaginationPage } from '../../../components/pagination-page';

const eventLabels: Record<string, string> = {
  'attendance.captured': 'Captura original',
  'attendance.captured-manual': 'Captura manual original',
  'attendance.corrected': 'Nueva versión corregida',
  'attendance.reviewed': 'Decisión administrativa',
  'attendance.annulled': 'Anulación administrativa',
};
function stateLabel(value: string) {
  return reviewLabels[value as keyof typeof reviewLabels] ?? value;
}
export function AdministrativeAttendanceDetailPage() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  const [historyPage, setHistoryPage] = useQueryState(
    'historyPage',
    parseAsInteger.withDefault(1).withOptions({ history: 'push', shallow: false }),
  );
  const valid = z.uuidv7().safeParse(id).success;
  const validPage = Number.isInteger(historyPage) && historyPage >= 1 && historyPage <= 1_000_000;
  const detail = useQuery({ ...administrativeDetailQuery(id), enabled: valid });
  const history = useQuery({
    queryKey: [...administrativeAttendanceKey, 'history', id, historyPage],
    queryFn: ({ signal }) => getAdministrativeHistory(id, historyPage, signal),
    enabled: valid && validPage && detail.isSuccess,
  });
  const back = new URLSearchParams(search);
  back.delete('historyPage');
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-touch items-center text-primary underline"
        to={`/asistencias${back.size ? `?${back}` : ''}`}
      >
        Volver a asistencias
      </Link>
      <PageHeader
        title="Detalle de asistencia"
        description="Captura, revisión y versiones históricas se presentan como evidencia independiente."
      />
      {!valid ? (
        <p role="alert">Identificador inválido.</p>
      ) : detail.isPending ? (
        <output>Cargando detalle de asistencia.</output>
      ) : detail.isError ? (
        <div role="alert">
          <p>{administrativeAttendanceError(detail.error)}</p>
          <Button variant="secondary" onClick={() => void detail.refetch()}>
            Reintentar detalle
          </Button>
        </div>
      ) : (
        <>
          <AdministrativeMarkCard mark={detail.data} />
          <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
            <h2 className="text-heading-sm">Captura original y versión consultada</h2>
            <p className="break-all">Registro: {detail.data.id}</p>
            <p className="break-words">
              Hora del evento original (UTC): {detail.data.originalEventTimestamp}
            </p>
            <p className="break-all">Actor de captura (ID): {detail.data.captureActorId}</p>
            {detail.data.predecessorId && (
              <Link
                className="inline-flex min-h-touch items-center break-all text-primary underline"
                to={`/asistencias/${detail.data.predecessorId}${search}`}
              >
                Ver versión anterior: {detail.data.predecessorId}
              </Link>
            )}
            {detail.data.manualReason !== null && (
              <p className="break-words whitespace-pre-wrap">
                Motivo de captura manual: {detail.data.manualReason}
              </p>
            )}
            {detail.data.correctionReason !== null && (
              <p className="break-words whitespace-pre-wrap">
                Motivo de corrección: {detail.data.correctionReason}
              </p>
            )}
          </section>
          <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
            <h2 className="text-heading-sm">Evidencia de ubicación no verificada</h2>
            <p>Esta evidencia no prueba presencia física.</p>
            {detail.data.locationEvidence.status === 'missing' ? (
              <p>Sin ubicación. Motivo reportado: {detail.data.locationEvidence.reason}</p>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-3">
                <div>
                  <dt>Latitud</dt>
                  <dd>{detail.data.locationEvidence.latitude}</dd>
                </div>
                <div>
                  <dt>Longitud</dt>
                  <dd>{detail.data.locationEvidence.longitude}</dd>
                </div>
                <div>
                  <dt>Precisión reportada (m)</dt>
                  <dd>{detail.data.locationEvidence.accuracy}</dd>
                </div>
              </dl>
            )}
          </section>
          <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
            <h2 className="text-heading-sm">Decisión administrativa expuesta</h2>
            {detail.data.decision.actorId === null &&
            detail.data.decision.timestamp === null &&
            detail.data.decision.reason === null ? (
              <p>Sin evidencia de decisión administrativa en este detalle.</p>
            ) : (
              <>
                {detail.data.decision.actorId !== null && (
                  <p className="break-all">Revisor (ID): {detail.data.decision.actorId}</p>
                )}
                {detail.data.decision.timestamp !== null && (
                  <p>Fecha de decisión (UTC): {detail.data.decision.timestamp}</p>
                )}
                {detail.data.decision.reason !== null && (
                  <p className="break-words whitespace-pre-wrap">
                    Motivo: {detail.data.decision.reason}
                  </p>
                )}
              </>
            )}
          </section>
          <ReviewAttendance key={id} record={detail.data} />
          <HistoricalAttendanceOperation
            key={`${id}-correct`}
            record={detail.data}
            operation="correct"
          />
          <HistoricalAttendanceOperation
            key={`${id}-annul`}
            record={detail.data}
            operation="annul"
          />
          <section className="space-y-4">
            <h2 className="text-heading-sm">Historial de versiones y decisiones</h2>
            <p>
              Solo evidencia expuesta por la API para las versiones de esta página. Las revisiones
              no incrementan la versión.
            </p>
            {!validPage ? (
              <p role="alert">Página de historial inválida.</p>
            ) : history.isPending ? (
              <output>Cargando historial de versiones.</output>
            ) : history.isError ? (
              <div role="alert">
                <p>{administrativeAttendanceError(history.error)}</p>
                <Button variant="secondary" onClick={() => void history.refetch()}>
                  Reintentar historial
                </Button>
              </div>
            ) : (
              <>
                {!history.data.items.length ? (
                  <p>No hay versiones en esta página.</p>
                ) : (
                  <ol className="relative space-y-4 border-s-2 border-border ps-4 sm:ps-6">
                    {history.data.items.map((version) => (
                      <li
                        key={version.id}
                        className="min-w-0 space-y-3 rounded-lg border bg-card p-4 sm:p-6"
                      >
                        <h3 className="text-subheading">
                          Versión {version.version}
                          {version.version === 1 ? ' · Captura original' : ' · Versión posterior'}
                        </h3>
                        <AdministrativeMarkCard mark={version} />
                        <Link
                          className="inline-flex min-h-touch items-center text-primary underline"
                          to={`/asistencias/${version.id}${search}`}
                        >
                          Consultar versión {version.version}
                        </Link>
                        {!version.events.length ? (
                          <p>Sin eventos expuestos para esta versión.</p>
                        ) : (
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {version.events.map((event, index) => (
                              <li key={index} className="min-w-0 space-y-2 rounded-md bg-muted p-4">
                                <p>
                                  {eventLabels[event.action] ?? event.action} · {event.timestamp}
                                </p>
                                {event.actorId !== null && (
                                  <p className="break-all">Actor (ID): {event.actorId}</p>
                                )}
                                {event.reason !== null && (
                                  <p className="break-words whitespace-pre-wrap">
                                    Motivo: {event.reason}
                                  </p>
                                )}
                                {event.previousStatus !== null && (
                                  <p>Estado anterior: {stateLabel(event.previousStatus)}</p>
                                )}
                                {event.reviewStatus !== null && (
                                  <p>Estado registrado: {stateLabel(event.reviewStatus)}</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                <PaginationPage
                  label="Paginación de versiones"
                  page={history.data.page}
                  total={history.data.total}
                  limit={history.data.limit}
                  previousDisabled={historyPage <= 1}
                  nextDisabled={historyPage * history.data.limit >= history.data.total}
                  onPreviousClick={() => void setHistoryPage(historyPage - 1)}
                  onNextClick={() => void setHistoryPage(historyPage + 1)}
                />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
