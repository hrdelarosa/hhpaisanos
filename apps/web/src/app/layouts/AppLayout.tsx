import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { Outlet } from 'react-router';

export function AppLayout() {
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
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-page space-y-6 p-4 wrap-anywhere sm:p-6"
      >
        <Outlet />
      </main>
    </NuqsAdapter>
  );
}
