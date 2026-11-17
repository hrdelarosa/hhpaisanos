import { Link, Outlet, useMatch } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';

export function ModulesLayout() {
  const { user } = useSession();
  const creating = useMatch('/modulos/nuevo');
  if (!user?.permissions.includes(creating ? 'attention-modules:create' : 'attention-modules:read'))
    return <p role="alert">No tienes permiso para esta sección de módulos de atención.</p>;
  return (
    <section className="min-w-0 space-y-6">
      {creating && (
        <nav aria-label="Módulos de atención" className="flex flex-wrap gap-4 text-body-sm">
          {user.permissions.includes('attention-modules:read') && (
            <Link
              className="inline-flex min-h-touch items-center text-primary underline"
              to="/modulos"
            >
              Consultar módulos
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
