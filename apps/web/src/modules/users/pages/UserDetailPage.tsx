import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { useSession } from '../../auth/hooks/use-session';
import { userQuery } from '../api/users';
import { ManageUser } from '../components/ManageUser';
import { userError } from '../utils/feedback';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  const { user } = useSession();
  const valid = z.uuidv7().safeParse(id).success;
  const query = useQuery({ ...userQuery(id), enabled: valid });
  if (!valid) return <p role="alert">El identificador de cuenta no es válido.</p>;
  if (query.isPending) return <output>Cargando cuenta…</output>;
  if (query.isError)
    return (
      <div role="alert">
        <p>{userError(query.error)}</p>
        <Button onClick={() => void query.refetch()}>Reintentar</Button>
      </div>
    );
  const account = query.data;
  const managed = ['ENLACE', 'OBSERVADOR'].includes(account.role);
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-touch items-center text-primary underline"
        to={`/cuentas${search}`}
      >
        Volver a cuentas
      </Link>
      <h1 className="break-words text-heading">Cuenta: {account.username}</h1>
      <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 sm:p-6">
        {[
          ['Nombre completo', account.fullName],
          ['Usuario (inmutable)', account.username],
          ['Rol', account.role],
          ['Identificador de rol', account.roleId],
          ['Estado de cuenta', account.active ? 'Activa' : 'Inactiva'],
          ['Cambio de contraseña obligatorio', account.mustChangePassword ? 'Sí' : 'No'],
          ['Último acceso (UTC)', account.lastLoginAt ?? 'Sin acceso registrado'],
          ['Identificador de cuenta', account.id],
          ['Creada (UTC)', account.createdAt],
          ['Actualizada (UTC)', account.updatedAt],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="break-all whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        No se exponen bloqueos temporales, actividad del rol ni sesiones. Una cuenta activa no
        garantiza acceso ni elegibilidad para vincular.
      </p>
      <Button variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>
        Consultar estado actual
      </Button>
      {user?.permissions.includes('observers:read') && (
        <Link
          className="inline-flex min-h-touch items-center text-primary underline"
          to="/observadores?linked=true"
        >
          Consultar relaciones en observadores
        </Link>
      )}
      {!managed && <p>Cuenta protegida: no se permiten cambios administrativos.</p>}
      {managed && user?.permissions.includes('users:update') && (
        <ManageUser key={`edit-${id}`} account={account} operation="edit" />
      )}
      {managed && user?.permissions.includes('users:change-status') && (
        <ManageUser key={`status-${id}`} account={account} operation="status" />
      )}
    </div>
  );
}
