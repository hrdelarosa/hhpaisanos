import { Outlet } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';

export function AdministrativeAttendanceLayout() {
  const { user } = useSession();
  if (
    !user ||
    !['ADMIN', 'ENLACE'].includes(user.role) ||
    !user.permissions.includes('attendance:read')
  )
    return <p role="alert">No tienes permiso para consultar asistencias administrativas.</p>;
  return (
    <section className="space-y-6">
      <p className="text-foreground-secondary">
        Ámbito: Guerrero. Las marcas faltantes no implican ausencia. La ubicación no verifica
        presencia física.
      </p>
      <Outlet />
    </section>
  );
}
