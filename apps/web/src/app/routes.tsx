import { lazy } from 'react';
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
import { ModulesLayout } from '../modules/attention-modules/components/ModulesLayout';
import { ObserversLayout } from '../modules/observers/components/ObserversLayout';
import { UsersLayout } from '../modules/users/components/UsersLayout';
import { AssignmentsLayout } from '../modules/assignments/components/AssignmentsLayout';
import { AdministrativeAttendanceLayout } from '../modules/attendance/components/AdministrativeAttendanceLayout';

const OperativesListPage = lazy(() =>
  import('../modules/operatives/pages/OperativesListPage').then((m) => ({
    default: m.OperativesListPage,
  })),
);
const CreateOperativePage = lazy(() =>
  import('../modules/operatives/pages/CreateOperativePage').then((m) => ({
    default: m.CreateOperativePage,
  })),
);
const OperativeDetailPage = lazy(() =>
  import('../modules/operatives/pages/OperativeDetailPage').then((m) => ({
    default: m.OperativeDetailPage,
  })),
);
const ModulesListPage = lazy(() =>
  import('../modules/attention-modules/pages/ModulesListPage').then((m) => ({
    default: m.ModulesListPage,
  })),
);
const CreateModulePage = lazy(() =>
  import('../modules/attention-modules/pages/CreateModulePage').then((m) => ({
    default: m.CreateModulePage,
  })),
);
const ModuleDetailPage = lazy(() =>
  import('../modules/attention-modules/pages/ModuleDetailPage').then((m) => ({
    default: m.ModuleDetailPage,
  })),
);
const ObserversListPage = lazy(() =>
  import('../modules/observers/pages/ObserversListPage').then((m) => ({
    default: m.ObserversListPage,
  })),
);
const CreateObserverPage = lazy(() =>
  import('../modules/observers/pages/CreateObserverPage').then((m) => ({
    default: m.CreateObserverPage,
  })),
);
const ObserverDetailPage = lazy(() =>
  import('../modules/observers/pages/ObserverDetailPage').then((m) => ({
    default: m.ObserverDetailPage,
  })),
);
const UsersListPage = lazy(() =>
  import('../modules/users/pages/UsersListPage').then((m) => ({ default: m.UsersListPage })),
);
const CreateUserPage = lazy(() =>
  import('../modules/users/pages/CreateUserPage').then((m) => ({ default: m.CreateUserPage })),
);
const UserDetailPage = lazy(() =>
  import('../modules/users/pages/UserDetailPage').then((m) => ({ default: m.UserDetailPage })),
);
const AssignmentsListPage = lazy(() =>
  import('../modules/assignments/pages/AssignmentsListPage').then((m) => ({
    default: m.AssignmentsListPage,
  })),
);
const CreateAssignmentPage = lazy(() =>
  import('../modules/assignments/pages/CreateAssignmentPage').then((m) => ({
    default: m.CreateAssignmentPage,
  })),
);
const AssignmentDetailPage = lazy(() =>
  import('../modules/assignments/pages/AssignmentDetailPage').then((m) => ({
    default: m.AssignmentDetailPage,
  })),
);
const AdministrativeAttendanceListPage = lazy(() =>
  import('../modules/attendance/pages/AdministrativeAttendanceListPage').then((m) => ({
    default: m.AdministrativeAttendanceListPage,
  })),
);
const AdministrativeAttendanceDetailPage = lazy(() =>
  import('../modules/attendance/pages/AdministrativeAttendanceDetailPage').then((m) => ({
    default: m.AdministrativeAttendanceDetailPage,
  })),
);
const ManualAttendancePage = lazy(() =>
  import('../modules/attendance/pages/ManualAttendancePage').then((m) => ({
    default: m.ManualAttendancePage,
  })),
);

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
                path: 'asistencias',
                element: <AdministrativeAttendanceLayout />,
                children: [
                  { index: true, element: <AdministrativeAttendanceListPage /> },
                  { path: 'manual', element: <ManualAttendancePage /> },
                  { path: ':id', element: <AdministrativeAttendanceDetailPage /> },
                ],
              },
              {
                path: 'asignaciones',
                element: <AssignmentsLayout />,
                children: [
                  { index: true, element: <AssignmentsListPage /> },
                  { path: 'nueva', element: <CreateAssignmentPage /> },
                  { path: ':id', element: <AssignmentDetailPage /> },
                ],
              },
              {
                path: 'cuentas',
                element: <UsersLayout />,
                children: [
                  { index: true, element: <UsersListPage /> },
                  { path: 'nueva', element: <CreateUserPage /> },
                  { path: ':id', element: <UserDetailPage /> },
                ],
              },
              {
                path: 'observadores',
                element: <ObserversLayout />,
                children: [
                  { index: true, element: <ObserversListPage /> },
                  { path: 'nuevo', element: <CreateObserverPage /> },
                  { path: ':id', element: <ObserverDetailPage /> },
                ],
              },
              {
                path: 'modulos',
                element: <ModulesLayout />,
                children: [
                  { index: true, element: <ModulesListPage /> },
                  { path: 'nuevo', element: <CreateModulePage /> },
                  { path: ':id', element: <ModuleDetailPage /> },
                ],
              },
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
