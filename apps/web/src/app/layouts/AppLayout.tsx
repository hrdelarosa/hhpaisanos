import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useRouteFocus } from '../use-route-focus';

export function AppLayout() {
  const main = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useRouteFocus(main, pathname);
  // All routes share this root so URL state uses one adapter beneath the router.
  return (
    <NuqsAdapter>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-10 focus:bg-background focus:p-4"
      >
        Saltar al contenido
      </a>
      <div ref={main} className="min-h-svh wrap-anywhere">
        <Outlet />
      </div>
    </NuqsAdapter>
  );
}
