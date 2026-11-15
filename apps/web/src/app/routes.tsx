import { Link, type RouteObject } from 'react-router';
import { HealthPage } from '../modules/health/pages/HealthPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthenticatedLayout } from '../modules/auth/components/AuthenticatedLayout';
import { RequireSession } from '../modules/auth/components/RequireSession';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { ChangePasswordPage } from '../modules/auth/pages/ChangePasswordPage';
import { SessionHomePage } from '../modules/auth/pages/SessionHomePage';
import { AttendanceLayout } from '../modules/attendance/components/AttendanceLayout';
import { TodayAttendancePage } from '../modules/attendance/pages/TodayAttendancePage';
import { AttendanceHistoryPage } from '../modules/attendance/pages/AttendanceHistoryPage';
import { OperativesLayout } from '../modules/operatives/components/OperativesLayout';
import { OperativesListPage } from '../modules/operatives/pages/OperativesListPage';
import { CreateOperativePage } from '../modules/operatives/pages/CreateOperativePage';
import { OperativeDetailPage } from '../modules/operatives/pages/OperativeDetailPage';

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
            children: [
              { index: true, element: <SessionHomePage /> },
              {
                path: 'operativos',
                element: <OperativesLayout />,
                children: [
                  { index: true, element: <OperativesListPage /> },
                  { path: 'nuevo', element: <CreateOperativePage /> },
                  { path: ':id', element: <OperativeDetailPage /> },
                ],
              },
              {
                path: 'mi-asistencia',
                element: <AttendanceLayout />,
                children: [
                  { index: true, element: <TodayAttendancePage /> },
                  { path: 'historial', element: <AttendanceHistoryPage /> },
                ],
              },
            ],
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
