import { Link, Outlet, useMatch } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';

export function ObserversLayout() {
  const { user } = useSession();
  const creating = useMatch('/observadores/nuevo');
  if (!user?.permissions.includes(creating ? 'observers:create' : 'observers:read'))
    return <p role="alert">No tienes permiso para esta sección de observadores.</p>;
  return (
    <section className="min-w-0 space-y-6">
      <nav aria-label="Observadores" className="flex flex-wrap gap-4 text-body-sm">
        {user.permissions.includes('observers:read') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/observadores"
          >
            Consultar observadores
          </Link>
        )}
        {user.permissions.includes('observers:create') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/observadores/nuevo"
          >
            Crear observador
          </Link>
        )}
      </nav>
      <Outlet />
      <p className="border-t pt-4 text-body-sm text-muted-foreground">
        Ámbito administrativo: Guerrero. Sin aislamiento por oficina.
      </p>
    </section>
  );
}
