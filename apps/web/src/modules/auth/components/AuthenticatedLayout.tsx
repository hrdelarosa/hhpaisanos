import { useRef, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { RouteContentBoundary } from '../../../app/RouteContentBoundary';
import { Button } from '../../../components/ui/button';
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../../../components/ui/sidebar';
import { useSession } from '../hooks/use-session';
import { AppNavigation } from './AppNavigation';
import { SiteBreadcrumbs } from './SiteBreadcrumbs';

export function AuthenticatedLayout({ children }: { children?: ReactNode }) {
  const session = useSession();
  const { pathname } = useLocation();
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const user = session.user;
  const initials =
    user?.fullName
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('') ?? '';

  return (
    <SidebarProvider>
      <Sidebar>
        <AppNavigation />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center border-b bg-card">
          <div className="flex w-full min-w-0 items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <SidebarTrigger />
            <span aria-hidden="true" className="h-7 w-px shrink-0 bg-border" />
            <div className="min-w-0 flex-1">
              <SiteBreadcrumbs />
            </div>
            {user && (
              <details ref={accountMenu} className="relative ml-auto shrink-0">
                <summary
                  aria-label={`Cuenta de ${user.fullName}, ${user.role}`}
                  className="flex min-h-touch cursor-pointer list-none items-center gap-2 rounded-md px-2 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-label text-secondary-foreground"
                  >
                    {initials}
                  </span>
                  <span className="hidden max-w-48 flex-col text-left text-body-sm sm:flex">
                    <span className="truncate font-medium">{user.fullName}</span>
                    <span className="truncate text-muted-foreground">{user.role}</span>
                  </span>
                </summary>
                <nav
                  aria-label="Acciones de cuenta"
                  className="absolute right-0 top-full z-30 mt-2 flex w-56 flex-col gap-1 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
                >
                  <Link
                    to="/cambiar-contrasena"
                    className="flex min-h-touch items-center rounded-md px-3 text-label hover:bg-secondary"
                    onClick={() => {
                      if (accountMenu.current) accountMenu.current.open = false;
                    }}
                  >
                    Cambiar contraseña
                  </Link>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    disabled={session.busy}
                    onClick={() => {
                      if (accountMenu.current) accountMenu.current.open = false;
                      void session.logout();
                    }}
                  >
                    {session.busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
                  </Button>
                </nav>
              </details>
            )}
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          data-route-content
          className="mx-auto w-full min-w-0 max-w-page flex-1 p-4 py-6 sm:p-6"
        >
          <RouteContentBoundary pathname={pathname}>{children ?? <Outlet />}</RouteContentBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
