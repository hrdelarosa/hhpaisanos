import { Navigate, Outlet } from 'react-router';
import { useSession } from '../hooks/use-session';
import { SessionStatus } from './SessionStatus';

export function RequireSession({ allowPasswordChange = false }: { allowPasswordChange?: boolean }) {
  const session = useSession();
  if (session.status === 'anonymous') return <Navigate to="/login" replace />;
  if (session.status !== 'authenticated') return <SessionStatus />;
  if (session.user?.mustChangePassword && !allowPasswordChange)
    return <Navigate to="/cambiar-contrasena" replace />;
  return <Outlet />;
}
