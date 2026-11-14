import { NavLink, Outlet } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';

export function AttendanceLayout() {
  const { user } = useSession();
  if (user?.role !== 'OBSERVADOR' || !user.permissions.includes('attendance:read-own'))
    return <p role="alert">No tienes permiso para consultar asistencia personal.</p>;

  return (
    <section className="space-y-6">
      <nav aria-label="Asistencia personal" className="flex flex-wrap gap-4">
        <NavLink
          className="inline-flex min-h-touch items-center text-primary underline"
          end
          to="/mi-asistencia"
        >
          Hoy
        </NavLink>
        <NavLink
          className="inline-flex min-h-touch items-center text-primary underline"
          to="/mi-asistencia/historial"
        >
          Historial
        </NavLink>
      </nav>
      <Outlet />
      <p className="text-body-sm text-foreground-secondary">
        La falta de marcas no determina una ausencia. La captura y su revisión no verifican por sí
        solas la presencia física.
      </p>
    </section>
  );
}
