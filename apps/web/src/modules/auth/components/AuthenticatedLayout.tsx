import { Link, Outlet, useLocation } from 'react-router';
import { RouteContentBoundary } from '../../../app/RouteContentBoundary';
import { Button } from '../../../components/ui/button';
import { useSession } from '../hooks/use-session';

export function AuthenticatedLayout() {
  const { user, logout, busy } = useSession();
  const { pathname } = useLocation();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <p className="text-subheading">Heroínas y Héroes Paisanos</p>
        <p>
          {user?.fullName} · {user?.role}
        </p>
        <nav aria-label="Sesión" className="flex flex-wrap items-center gap-4">
          <Link className="inline-flex min-h-touch items-center text-primary underline" to="/">
            Inicio
          </Link>
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/cambiar-contrasena"
          >
            Cambiar contraseña
          </Link>
          <Button variant="secondary" disabled={busy} onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </nav>
      </header>
      <div data-route-content>
        <RouteContentBoundary pathname={pathname}>
          <Outlet />
        </RouteContentBoundary>
      </div>
    </div>
  );
}
