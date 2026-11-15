import { Link, Outlet, useMatch } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';

export function OperativesLayout() {
  const { user } = useSession();
  const creating = useMatch('/operativos/nuevo');
  const permission = creating ? 'operatives:create' : 'operatives:read';
  if (!user?.permissions.includes(permission))
    return <p role="alert">No tienes permiso para esta sección de operativos.</p>;
  return (
    <section className="space-y-6">
      <nav aria-label="Operativos" className="flex flex-wrap gap-4">
        {user.permissions.includes('operatives:read') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/operativos"
          >
            Consultar operativos
          </Link>
        )}
        {user.permissions.includes('operatives:create') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/operativos/nuevo"
          >
            Crear operativo
          </Link>
        )}
      </nav>
      <p className="text-foreground-secondary">
        Ámbito administrativo: Guerrero. Sin aislamiento por oficina.
      </p>
      <Outlet />
    </section>
  );
}
