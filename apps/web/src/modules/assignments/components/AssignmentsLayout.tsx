import { Link, Outlet, useMatch } from 'react-router';
import { useSession } from '../../auth/hooks/use-session';

export function AssignmentsLayout() {
  const { user } = useSession();
  const creating = useMatch('/asignaciones/nueva');
  if (!user?.permissions.includes(creating ? 'assignments:create' : 'assignments:read'))
    return <p role="alert">No tienes permiso para esta sección de asignaciones.</p>;
  return (
    <section className="space-y-6">
      <nav aria-label="Asignaciones" className="flex flex-wrap gap-4">
        {user.permissions.includes('assignments:read') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/asignaciones"
          >
            Consultar asignaciones
          </Link>
        )}
        {user.permissions.includes('assignments:create') && (
          <Link
            className="inline-flex min-h-touch items-center text-primary underline"
            to="/asignaciones/nueva"
          >
            Crear asignación
          </Link>
        )}
      </nav>
      <p className="text-foreground-secondary">
        Ámbito: Guerrero. Los períodos conservan el historial de asistencia; su vigencia no acredita
        por sí sola elegibilidad para capturar.
      </p>
      <Outlet />
    </section>
  );
}
