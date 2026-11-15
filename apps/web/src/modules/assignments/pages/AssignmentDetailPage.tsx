import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { assignmentQuery } from '../api/assignments';
import { ManageAssignment } from '../components/ManageAssignment';
import { ResourceName } from '../components/ResourcePicker';
import { assignmentError, assignmentStatus } from '../utils/feedback';

export function AssignmentDetailPage() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  const valid = z.uuidv7().safeParse(id).success;
  const query = useQuery({ ...assignmentQuery(id), enabled: valid });
  return (
    <div className="space-y-4">
      <Link
        className="inline-flex min-h-touch items-center text-primary underline"
        to={`/asignaciones${search}`}
      >
        Volver a asignaciones
      </Link>
      {!valid ? (
        <p role="alert">Identificador de asignación inválido.</p>
      ) : query.isPending ? (
        <output>Cargando asignación.</output>
      ) : query.isError ? (
        <div role="alert">
          <p>{assignmentError(query.error)}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <h1 className="text-heading">Detalle de asignación</h1>
          <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 sm:p-6">
            <div>
              <dt>Identificador</dt>
              <dd className="break-all">{query.data.id}</dd>
            </div>
            <div>
              <dt>Estado por calendario de México (orientativo)</dt>
              <dd>{assignmentStatus(query.data)}</dd>
            </div>
            <div>
              <dt>Observador</dt>
              <dd>
                <ResourceName kind="observer" id={query.data.observerId} />
              </dd>
            </div>
            <div>
              <dt>Operativo</dt>
              <dd>
                <ResourceName kind="operative" id={query.data.operativeId} />
              </dd>
            </div>
            <div>
              <dt>Módulo de atención</dt>
              <dd>
                <ResourceName kind="module" id={query.data.attentionModuleId} />
              </dd>
            </div>
            <div>
              <dt>Vigencia inclusiva</dt>
              <dd>
                {query.data.validFrom} — {query.data.validTo}
              </dd>
            </div>
            <div>
              <dt>Horario de México</dt>
              <dd>
                {query.data.startTime} — {query.data.endTime}
              </dd>
            </div>
            <div>
              <dt>Versión</dt>
              <dd>{query.data.version}</dd>
            </div>
            <div>
              <dt>Creación</dt>
              <dd className="break-all">
                <time dateTime={query.data.createdAt}>{query.data.createdAt}</time>
              </dd>
            </div>
            <div>
              <dt>Actualización</dt>
              <dd className="break-all">
                <time dateTime={query.data.updatedAt}>{query.data.updatedAt}</time>
              </dd>
            </div>
            {query.data.cancelledAt && (
              <div>
                <dt>Cancelación confirmada</dt>
                <dd className="break-all">
                  <time dateTime={query.data.cancelledAt}>{query.data.cancelledAt}</time>
                </dd>
              </div>
            )}
          </dl>
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to={`/asignaciones?observerId=${query.data.observerId}`}
          >
            Consultar todos los períodos del observador
          </Link>
          <p>
            No existe un historial de motivos ni un vínculo de reemplazo en esta lectura. Una fecha
            final no distingue expiración natural de finalización administrativa.
          </p>
          <ManageAssignment key={query.data.id} assignment={query.data} />
        </>
      )}
    </div>
  );
}
