import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
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
      <header className="space-y-2">
        <p className="text-foreground-secondary">Contexto administrativo seleccionado</p>
        <h1 className="text-heading">{operative.name}</h1>
      </header>
      <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 sm:p-6">
        <div>
          <dt>Estado</dt>
          <dd>{statusLabels[operative.status]}</dd>
        </div>
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
