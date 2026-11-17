import { Link, Outlet, useMatch } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';

export function OperativesLayout() {
  const { user } = useSession();
  const creating = useMatch('/operativos/nuevo');
  const permission = creating ? 'operatives:create' : 'operatives:read';
  if (!user?.permissions.includes(permission))
    return <p role="alert">No tienes permiso para esta sección de operativos.</p>;
  return (
    <section className="min-w-0 space-y-6">
      {creating && (
        <nav aria-label="Operativos" className="flex flex-wrap gap-4 text-body-sm">
          {user.permissions.includes('operatives:read') && (
            <Link
              className="inline-flex min-h-touch items-center text-primary underline"
              to="/operativos"
            >
              Consultar operativos
            </Link>
          )}
        </nav>
      )}
      <Outlet />
      <p className="border-t pt-4 text-body-sm text-muted-foreground">
        Ámbito administrativo: Guerrero. Sin aislamiento por oficina.
      </p>
    </section>
  );
}
