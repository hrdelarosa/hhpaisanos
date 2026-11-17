import { Link, useLocation } from 'react-router';
import { Brand } from '../../../components/Brand';
import { Button } from '../../../components/ui/button';
import { NavigationIcon } from '../../../components/ui/navigation-icon';
import { cn } from '../../../lib/utils';
import { useSession } from '../hooks/use-session';
import { availableSections, sectionDestination } from '../utils/navigation';

export function AppNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, busy } = useSession();
  const { pathname: routePath } = useLocation();
  const pathname = routePath.toLowerCase().replace(/\/+$/u, '') || '/';
  const sections = availableSections(user);
  const groups = [...new Set(sections.map((section) => section.group))];
  const linkClass = (active: boolean) =>
    cn(
      'flex min-h-touch items-center gap-3 rounded-md border-l-4 px-3 py-2 text-label',
      active
        ? 'border-current bg-secondary font-semibold text-secondary-foreground'
        : 'border-transparent hover:bg-primary',
    );
  return (
    <div className="flex min-h-full flex-col gap-6 p-4">
      <Link to="/" aria-label="Inicio de Paisanos" onClick={onNavigate} className="block">
        <Brand />
      </Link>
      <nav aria-label="Navegación principal" className="flex flex-col gap-6">
        <Link
          to="/"
          aria-current={pathname === '/' ? 'page' : undefined}
          className={linkClass(pathname === '/')}
          onClick={onNavigate}
        >
          <NavigationIcon name="home" />
          Inicio
        </Link>
        {groups.map((group) => (
          <section key={group} className="flex flex-col gap-2">
            <h2 className="px-4 text-body-sm">{group}</h2>
            <ul className="flex flex-col gap-1">
              {sections
                .filter((section) => section.group === group)
                .map((section) => {
                  const destination = sectionDestination(section);
                  const active =
                    pathname === destination.path ||
                    (section.canRead &&
                      section.id !== 'personal' &&
                      pathname.startsWith(section.path + '/'));
                  return (
                    <li key={section.id}>
                      <Link
                        to={destination.path}
                        aria-current={active ? 'page' : undefined}
                        className={linkClass(active)}
                        onClick={onNavigate}
                      >
                        <NavigationIcon name={section.icon} />
                        <span>{destination.label}</span>
                      </Link>
                      {section.id === 'personal' && (
                        <Link
                          to="/mi-asistencia/historial"
                          aria-current={
                            pathname === '/mi-asistencia/historial' ? 'page' : undefined
                          }
                          className={linkClass(pathname === '/mi-asistencia/historial')}
                          onClick={onNavigate}
                        >
                          <NavigationIcon name="clipboard" />
                          Historial personal
                        </Link>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </nav>
      <section
        aria-label="Tu cuenta"
        className="mt-auto flex flex-col gap-3 border-t border-primary pt-4"
      >
        <div className="flex flex-col gap-1 px-3">
          <p className="text-label">{user?.fullName}</p>
          <p className="text-body-sm">{user?.role}</p>
        </div>
        <nav aria-label="Sesión" className="flex flex-col gap-2">
          <Link
            to="/cambiar-contrasena"
            className="flex min-h-touch items-center rounded-md px-3 text-label hover:bg-primary"
            onClick={onNavigate}
          >
            Cambiar contraseña
          </Link>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              onNavigate?.();
              void logout();
            }}
          >
            Cerrar sesión
          </Button>
        </nav>
      </section>
    </div>
  );
}
