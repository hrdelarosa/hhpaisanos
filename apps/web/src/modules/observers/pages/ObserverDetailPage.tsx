import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { useSession } from '../../auth/hooks/use-session';
import { observerQuery } from '../api/observers';
import { EditObserver } from '../components/EditObserver';
import { ChangeObserverStatus } from '../components/ChangeObserverStatus';
import { LinkObserverAccount } from '../components/LinkObserverAccount';
import { observerError } from '../utils/feedback';

export function ObserverDetailPage() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  const { user } = useSession();
  const valid = z.uuidv7().safeParse(id).success;
  const query = useQuery({ ...observerQuery(id), enabled: valid });
  if (!valid) return <p role="alert">El identificador del observador no es válido.</p>;
  if (query.isPending) return <output>Cargando detalle del observador…</output>;
  if (query.isError)
    return (
      <div role="alert" className="space-y-2">
        <p>{observerError(query.error)}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  const observer = query.data;
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-touch items-center text-primary underline"
        to={`/observadores${search}`}
      >
        Volver a observadores
      </Link>
      <h1 className="break-words text-heading">
        {observer.firstNames} {observer.lastNames}
      </h1>
      <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 sm:p-6">
        <div>
          <dt>Nombres</dt>
          <dd className="break-words whitespace-pre-wrap">{observer.firstNames}</dd>
        </div>
        <div>
          <dt>Apellidos</dt>
          <dd className="break-words whitespace-pre-wrap">{observer.lastNames}</dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd className="break-words whitespace-pre-wrap">{observer.phone ?? 'Sin teléfono'}</dd>
        </div>
        <div>
          <dt>Estado del perfil</dt>
          <dd>{observer.active ? 'Activo' : 'Inactivo'}</dd>
        </div>
        <div>
          <dt>Identificador del perfil</dt>
          <dd className="break-all">{observer.id}</dd>
        </div>
        <div>
          <dt>Cuenta vinculada (identificador)</dt>
          <dd className="break-all">{observer.userId ?? 'Sin cuenta vinculada'}</dd>
        </div>
        <div>
          <dt>Creado (UTC)</dt>
          <dd className="break-all">
            <time dateTime={observer.createdAt.replace(' ', 'T') + 'Z'}>{observer.createdAt}</time>
          </dd>
        </div>
        <div>
          <dt>Actualizado (UTC)</dt>
          <dd className="break-all">
            <time dateTime={observer.updatedAt.replace(' ', 'T') + 'Z'}>{observer.updatedAt}</time>
          </dd>
        </div>
      </dl>
      {user?.permissions.includes('assignments:read') && (
        <Link
          className="inline-flex min-h-touch items-center text-primary underline"
          to={`/asignaciones?observerId=${observer.id}`}
        >
          Consultar asignaciones del observador
        </Link>
      )}
      <p>
        El perfil no es una cuenta de acceso. La vinculación mostrada no informa el estado de la
        cuenta ni sus permisos o asignaciones.
      </p>
      <Button variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>
        Consultar estado actual
      </Button>
      <LinkObserverAccount key={`link-${id}`} observer={observer} />
      {user?.permissions.includes('observers:update') && (
        <EditObserver key={`edit-${id}`} observer={observer} />
      )}
      {user?.permissions.includes('observers:change-status') && (
        <ChangeObserverStatus key={`status-${id}`} observer={observer} />
      )}
    </div>
  );
}
