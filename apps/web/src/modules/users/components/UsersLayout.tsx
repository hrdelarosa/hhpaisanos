import { Link, Outlet, useMatch } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';

export function UsersLayout() {
  const { user } = useSession();
  const creating = useMatch('/cuentas/nueva');
  if (
    user?.role !== 'ADMIN' ||
    !user.permissions.includes(creating ? 'users:create' : 'users:read')
  )
    return <p role="alert">No tienes permiso para esta sección de cuentas.</p>;
  return (
    <section className="space-y-6">
      <nav aria-label="Cuentas" className="flex flex-wrap gap-4">
        {user.permissions.includes('users:read') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/cuentas"
          >
            Consultar cuentas
          </Link>
        )}
        {user.permissions.includes('users:create') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/cuentas/nueva"
          >
            Crear cuenta
          </Link>
        )}
      </nav>
      <p className="text-foreground-secondary">
        Ámbito administrativo: Guerrero. Las cuentas y los perfiles de observador son
        independientes.
      </p>
      <Outlet />
    </section>
  );
}
