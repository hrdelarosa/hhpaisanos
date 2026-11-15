import { Link, Outlet, useMatch } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';

export function ModulesLayout() {
  const { user } = useSession();
  const creating = useMatch('/modulos/nuevo');
  if (!user?.permissions.includes(creating ? 'attention-modules:create' : 'attention-modules:read'))
    return <p role="alert">No tienes permiso para esta sección de módulos de atención.</p>;
  return (
    <section className="space-y-6">
      <nav aria-label="Módulos de atención" className="flex flex-wrap gap-4">
        {user.permissions.includes('attention-modules:read') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/modulos"
          >
            Consultar módulos
          </Link>
        )}
        {user.permissions.includes('attention-modules:create') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/modulos/nuevo"
          >
            Crear módulo
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
