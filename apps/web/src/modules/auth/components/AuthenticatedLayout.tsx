import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';
import { RouteContentBoundary } from '../../../app/RouteContentBoundary';
import { Brand } from '../../../components/Brand';
import { Button } from '../../../components/ui/button';
import { NavigationIcon } from '../../../components/ui/navigation-icon';
import { useSession } from '../hooks/use-session';
import { AppNavigation } from './AppNavigation';
import { SiteBreadcrumbs } from './SiteBreadcrumbs';

export function AuthenticatedLayout({ children }: { children?: ReactNode }) {
  const { user } = useSession();
  const { pathname } = useLocation();
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wide, setWide] = useState(
    () => window.matchMedia?.('(min-width: 1024px)').matches ?? true,
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const sidebarHadFocus = useRef(false);

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 1024px)');
    if (!media) return;
    const change = () => {
      dialog.current?.close();
      setMobileOpen(false);
      // CSS can hide the focused link (leaving body focused) before matchMedia fires.
      if (sidebarHadFocus.current) trigger.current?.focus();
      setWide(media.matches);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  const closeMobile = () => dialog.current?.close();
  return (
    <div
      className="flex min-h-svh min-w-0"
      onFocusCapture={(event) => {
        sidebarHadFocus.current = sidebar.current?.contains(event.target) ?? false;
      }}
      onPointerDownCapture={(event) => {
        if (event.target instanceof Node && !sidebar.current?.contains(event.target))
          sidebarHadFocus.current = false;
      }}
    >
      <aside
        ref={sidebar}
        id="desktop-navigation"
        aria-label="Barra lateral"
        hidden={!desktopOpen}
        className="app-sidebar sticky top-0 hidden h-svh w-sidebar shrink-0 overflow-y-auto bg-primary-hover text-primary-foreground lg:block"
      >
        <AppNavigation />
      </aside>
      <dialog
        ref={dialog}
        id="mobile-navigation"
        aria-labelledby="mobile-navigation-title"
        className="mobile-navigation m-0 h-svh max-h-none w-sidebar max-w-full border-0 bg-primary-hover p-0 text-primary-foreground"
        onClose={() => setMobileOpen(false)}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <h2 id="mobile-navigation-title" className="text-subheading">
            Navegación
          </h2>
          <Button variant="secondary" aria-label="Cerrar navegación" onClick={closeMobile}>
            <NavigationIcon name="close" />
          </Button>
        </div>
        <AppNavigation onNavigate={closeMobile} />
      </dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 flex-wrap items-center gap-3 border-b bg-card px-4 py-2 sm:px-6">
          <Button
            ref={trigger}
            variant="secondary"
            aria-label="Alternar navegación"
            aria-expanded={wide ? desktopOpen : mobileOpen}
            aria-controls={wide ? 'desktop-navigation' : 'mobile-navigation'}
            onClick={() => {
              if (wide) setDesktopOpen((open) => !open);
              else {
                dialog.current?.showModal();
                setMobileOpen(true);
              }
            }}
          >
            <NavigationIcon name="menu" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="lg:hidden">
              <Brand variant="compact" />
            </span>
            <SiteBreadcrumbs />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-label text-secondary-foreground"
            >
              {user?.fullName
                .trim()
                .split(/\s+/u)
                .slice(0, 2)
                .map((part) => Array.from(part)[0])
                .join('')}
            </span>
            <div className="hidden max-w-64 flex-col text-body-sm sm:flex">
              <p className="text-label">{user?.fullName}</p>
              <p className="text-muted-foreground">{user?.role}</p>
            </div>
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
      </div>
    </div>
  );
}
