import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/page-header';
import { StatusBadge } from '../../../components/status-badge';
import { useSession } from '../../auth/hooks/use-session';
import { operativeQuery } from '../api/operatives';
import { ActivateOperative } from '../components/ActivateOperative';
import { operativeError, statusLabels } from '../utils/feedback';

export function OperativeDetailPage() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  const { user } = useSession();
  const valid = z.uuidv7().safeParse(id).success;
  const query = useQuery({ ...operativeQuery(id), enabled: valid });
  if (!valid) return <p role="alert">El identificador del operativo no es válido.</p>;
  if (query.isPending) return <output>Cargando detalle del operativo…</output>;
  if (query.isError)
    return (
      <div role="alert" className="space-y-2">
        <p>{operativeError(query.error)}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  const operative = query.data;
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-touch items-center text-primary underline"
        to={`/operativos${search}`}
      >
        Volver a operativos
      </Link>
      <PageHeader
        title={operative.name}
        description="Contexto administrativo seleccionado"
        actions={
          <StatusBadge
            label={statusLabels[operative.status]}
            tone={
              operative.status === 'activo'
                ? 'success'
                : operative.status === 'borrador'
                  ? 'warning'
                  : 'neutral'
            }
          />
        }
      />
      <section
        aria-labelledby="operative-summary-title"
        className="rounded-lg border bg-card p-4 sm:p-6"
      >
        <h2 id="operative-summary-title" className="mb-6 text-subheading">
          Información del operativo
        </h2>
        <dl className="grid gap-6 text-body-sm sm:grid-cols-2 [&_dt]:mb-1 [&_dt]:text-muted-foreground [&_dd]:font-medium">
          <div>
            <dt>Identificador</dt>
            <dd className="break-all">{operative.id}</dd>
          </div>
          <div>
            <dt>Fecha inicial</dt>
            <dd>
              <time>{operative.startDate}</time>
            </dd>
          </div>
          <div>
            <dt>Fecha final</dt>
            <dd>
              <time>{operative.endDate}</time>
            </dd>
          </div>
          <div>
            <dt>
              {operative.status === 'borrador'
                ? 'Tolerancia almacenada (aún sin activar)'
                : 'Tolerancia de llegada'}
            </dt>
            <dd>
              {operative.arrivalToleranceMinutes === null
                ? 'Sin configurar'
                : `${operative.arrivalToleranceMinutes} minutos`}
            </dd>
          </div>
          <div>
            <dt>Creado (UTC)</dt>
            <dd className="break-all">
              <time dateTime={operative.createdAt}>{operative.createdAt}</time>
            </dd>
          </div>
          <div>
            <dt>Actualizado (UTC)</dt>
            <dd className="break-all">
              <time dateTime={operative.updatedAt}>{operative.updatedAt}</time>
            </dd>
          </div>
        </dl>
      </section>
      {user?.permissions.includes('assignments:read') && (
        <Link
          className="inline-flex min-h-touch items-center text-primary underline"
          to={`/asignaciones?operativeId=${operative.id}`}
        >
          Consultar asignaciones del operativo
        </Link>
      )}
      {user?.permissions.includes('operatives:activate') && (
        <ActivateOperative key={operative.id} operative={operative} />
      )}
    </div>
  );
}
