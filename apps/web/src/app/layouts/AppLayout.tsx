import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useRouteFocus } from '../use-route-focus';

export function AppLayout() {
  const main = useRef<HTMLElement>(null);
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
      <main
        ref={main}
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-page space-y-6 p-4 wrap-anywhere sm:p-6"
      >
        <Outlet />
      </main>
    </NuqsAdapter>
  );
}
