import { Link, type RouteObject } from 'react-router';
import { HealthPage } from '../modules/health/pages/HealthPage';
import { AppLayout } from './layouts/AppLayout';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HealthPage /> },
      {
        path: '*',
        element: (
          <section className="space-y-4">
            <h1 className="text-heading font-semibold">Página no encontrada</h1>
            <Link className="inline-flex min-h-touch items-center text-primary underline" to="/">
              Volver al inicio
            </Link>
          </section>
        ),
      },
    ],
  },
];
