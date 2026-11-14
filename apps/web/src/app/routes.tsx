import { Link, type RouteObject } from 'react-router';
import { HealthPage } from '../modules/health/pages/HealthPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthenticatedLayout } from '../modules/auth/components/AuthenticatedLayout';
import { RequireSession } from '../modules/auth/components/RequireSession';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { ChangePasswordPage } from '../modules/auth/pages/ChangePasswordPage';
import { SessionHomePage } from '../modules/auth/pages/SessionHomePage';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'estado', element: <HealthPage /> },
      {
        element: <RequireSession />,
        children: [
          {
            element: <AuthenticatedLayout />,
            children: [{ index: true, element: <SessionHomePage /> }],
          },
        ],
      },
      {
        element: <RequireSession allowPasswordChange />,
        children: [{ path: 'cambiar-contrasena', element: <ChangePasswordPage /> }],
      },
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
