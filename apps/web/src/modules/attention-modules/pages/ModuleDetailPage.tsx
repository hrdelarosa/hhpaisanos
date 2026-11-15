import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { useSession } from '../../auth/hooks/use-session';
import { moduleQuery } from '../api/attention-modules';
import { EditModule } from '../components/EditModule';
import { ChangeModuleStatus } from '../components/ChangeModuleStatus';
import { moduleError } from '../utils/feedback';

export function ModuleDetailPage() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  const { user } = useSession();
  const valid = z.uuidv7().safeParse(id).success;
  const query = useQuery({ ...moduleQuery(id), enabled: valid });
  if (!valid) return <p role="alert">El identificador del módulo no es válido.</p>;
  if (query.isPending) return <output>Cargando detalle del módulo…</output>;
  if (query.isError)
    return (
      <div role="alert" className="space-y-2">
        <p>{moduleError(query.error)}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  const module = query.data;
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-touch items-center text-primary underline"
        to={`/modulos${search}`}
      >
        Volver a módulos
      </Link>
      <h1 className="text-heading">{module.name}</h1>
      <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 sm:p-6">
        <div>
          <dt>Municipio</dt>
          <dd>{module.municipality}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{module.active ? 'Activo' : 'Inactivo'}</dd>
        </div>
        <div>
          <dt>Identificador</dt>
          <dd className="break-all">{module.id}</dd>
        </div>
        <div>
          <dt>Creado (UTC)</dt>
          <dd className="break-all">
            <time dateTime={module.createdAt}>{module.createdAt}</time>
          </dd>
        </div>
        <div>
          <dt>Actualizado (UTC)</dt>
          <dd className="break-all">
            <time dateTime={module.updatedAt}>{module.updatedAt}</time>
          </dd>
        </div>
      </dl>
      <Button variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>
        Consultar estado actual
      </Button>
      {user?.permissions.includes('attention-modules:update') && (
        <EditModule key={`edit-${id}`} module={module} />
      )}
      {user?.permissions.includes('attention-modules:change-status') && (
        <ChangeModuleStatus key={`status-${id}`} module={module} />
      )}
    </div>
  );
}
