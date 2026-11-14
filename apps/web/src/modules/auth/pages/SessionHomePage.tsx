import { useSession } from '../hooks/use-session';

const sections = [
  { label: 'Asistencia personal', permission: 'attendance:read-own', roles: ['OBSERVADOR'] },
  {
    label: 'Asistencias administrativas',
    permission: 'attendance:read',
    roles: ['ADMIN', 'ENLACE'],
  },
  { label: 'Operativos', permission: 'operatives:read', roles: ['ADMIN', 'ENLACE'] },
  {
    label: 'Módulos de atención',
    permission: 'attention-modules:read',
    roles: ['ADMIN', 'ENLACE'],
  },
  { label: 'Observadores', permission: 'observers:read', roles: ['ADMIN', 'ENLACE'] },
  { label: 'Asignaciones', permission: 'assignments:read', roles: ['ADMIN', 'ENLACE'] },
  { label: 'Cuentas', permission: 'users:read', roles: ['ADMIN'] },
];

export function SessionHomePage() {
  const { user } = useSession();
  const available = sections.filter(
    (item) => user && item.roles.includes(user.role) && user.permissions.includes(item.permission),
  );
  return (
    <section className="space-y-4">
      <h1 className="text-heading">Sesión activa</h1>
      <p>Ámbito operativo: Guerrero.</p>
      <nav aria-label="Secciones autorizadas" className="space-y-4">
        <h2 className="text-heading-sm">Accesos según tus permisos</h2>
        <p className="text-foreground-secondary">
          Estas secciones se habilitarán en las siguientes etapas. Aún no están disponibles.
        </p>
        {available.length ? (
          <ul className="space-y-2">
            {available.map((item) => (
              <li key={item.permission}>
                <span aria-disabled="true">{item.label} · Próximamente</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No tienes permisos de consulta para las secciones operativas.</p>
        )}
      </nav>
    </section>
  );
}
