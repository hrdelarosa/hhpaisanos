import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/page-header';
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
      <PageHeader
        title={`Cuenta: ${account.username}`}
        description="Identidad, acceso y estado administrativo de la cuenta."
      />
      <section
        aria-labelledby="account-summary-title"
        className="rounded-lg border bg-card p-4 sm:p-6"
      >
        <h2 id="account-summary-title" className="mb-6 text-subheading">
          Información de la cuenta
        </h2>
        <dl className="grid gap-6 text-body-sm sm:grid-cols-2 [&_dt]:mb-1 [&_dt]:text-muted-foreground [&_dd]:font-medium">
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
      </section>
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
