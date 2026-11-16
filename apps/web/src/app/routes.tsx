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
import { ModulesLayout } from '../modules/attention-modules/components/ModulesLayout';
import { ModulesListPage } from '../modules/attention-modules/pages/ModulesListPage';
import { CreateModulePage } from '../modules/attention-modules/pages/CreateModulePage';
import { ModuleDetailPage } from '../modules/attention-modules/pages/ModuleDetailPage';
import { ObserversLayout } from '../modules/observers/components/ObserversLayout';
import { ObserversListPage } from '../modules/observers/pages/ObserversListPage';
import { CreateObserverPage } from '../modules/observers/pages/CreateObserverPage';
import { ObserverDetailPage } from '../modules/observers/pages/ObserverDetailPage';
import { UsersLayout } from '../modules/users/components/UsersLayout';
import { UsersListPage } from '../modules/users/pages/UsersListPage';
import { UserDetailPage } from '../modules/users/pages/UserDetailPage';
import { CreateUserPage } from '../modules/users/pages/CreateUserPage';
import { AssignmentsLayout } from '../modules/assignments/components/AssignmentsLayout';
import { AssignmentsListPage } from '../modules/assignments/pages/AssignmentsListPage';
import { AssignmentDetailPage } from '../modules/assignments/pages/AssignmentDetailPage';
import { CreateAssignmentPage } from '../modules/assignments/pages/CreateAssignmentPage';
import { AdministrativeAttendanceLayout } from '../modules/attendance/components/AdministrativeAttendanceLayout';
import { AdministrativeAttendanceListPage } from '../modules/attendance/pages/AdministrativeAttendanceListPage';
import { AdministrativeAttendanceDetailPage } from '../modules/attendance/pages/AdministrativeAttendanceDetailPage';

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
