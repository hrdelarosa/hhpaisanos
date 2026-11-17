import { Link, useLocation } from 'react-router';
import { useSession } from '../hooks/use-session';
import { availableSections, navigationSections } from '../utils/navigation';

export function SiteBreadcrumbs() {
  const { user } = useSession();
  const { pathname: routePath } = useLocation();
  const pathname = routePath.toLowerCase().replace(/\/+$/u, '') || '/';
  const section = navigationSections.find(
    (item) => pathname === item.path || pathname.startsWith(item.path + '/'),
  );
  const canRead = availableSections(user).some((item) => item.id === section?.id && item.canRead);
  const current =
    pathname === '/'
      ? null
      : (section?.label ??
        (pathname === '/estado' ? 'Estado del servicio' : 'Página no encontrada'));
  const child =
    section && pathname !== section.path
      ? 'create' in section && section.create.path === pathname
        ? section.create.label
        : pathname.endsWith('/historial')
          ? 'Historial'
          : pathname.endsWith('/manual')
            ? 'Captura manual'
            : 'Detalle'
      : null;
  return (
    <nav aria-label="Ubicación" className="min-w-0 text-body-sm text-foreground-secondary">
      <ol className="flex flex-wrap items-center gap-x-2">
        <li>
          {current ? (
            <Link
              to="/"
              aria-label="Ir al inicio"
              className="inline-flex min-h-touch items-center text-primary underline"
            >
              Inicio
            </Link>
          ) : (
            <span aria-current="page">Inicio</span>
          )}
        </li>
        {current && (
          <li className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true">/</span>
            {child && section && canRead ? (
              <Link
                to={section.path}
                aria-label={`Ir a ${section.label}`}
                className="inline-flex min-h-touch items-center text-primary underline"
              >
                {section.label}
              </Link>
            ) : (
              <span aria-current={child ? undefined : 'page'}>{current}</span>
            )}
          </li>
        )}
        {child && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            <span aria-current="page">{child}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}
