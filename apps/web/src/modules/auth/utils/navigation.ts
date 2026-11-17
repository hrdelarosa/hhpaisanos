import type { AuthUser } from '../schemas/auth';

export const navigationSections = [
  {
    id: 'personal',
    group: 'Mi asistencia',
    label: 'Asistencia personal',
    description: 'Consulta tu jornada y registra las marcas disponibles.',
    path: '/mi-asistencia',
    permission: 'attendance:read-own',
    roles: ['OBSERVADOR'],
    icon: 'calendar',
  },
  {
    id: 'operatives',
    group: 'Operación',
    label: 'Operativos',
    description: 'Consulta los periodos y la configuración de los operativos.',
    path: '/operativos',
    permission: 'operatives:read',
    roles: ['ADMIN', 'ENLACE'],
    icon: 'layers',
    create: {
      label: 'Crear operativo',
      path: '/operativos/nuevo',
      permission: 'operatives:create',
    },
  },
  {
    id: 'modules',
    group: 'Operación',
    label: 'Módulos de atención',
    description: 'Consulta los puntos de atención y sus datos operativos.',
    path: '/modulos',
    permission: 'attention-modules:read',
    roles: ['ADMIN', 'ENLACE'],
    icon: 'location',
    create: {
      label: 'Crear módulo',
      path: '/modulos/nuevo',
      permission: 'attention-modules:create',
    },
  },
  {
    id: 'observers',
    group: 'Operación',
    label: 'Observadores',
    description: 'Administra los perfiles y su vinculación con las cuentas.',
    path: '/observadores',
    permission: 'observers:read',
    roles: ['ADMIN', 'ENLACE'],
    icon: 'people',
    create: {
      label: 'Crear observador',
      path: '/observadores/nuevo',
      permission: 'observers:create',
    },
  },
  // Assignments intentionally uses explicit permissions without an additional role gate.
  {
    id: 'assignments',
    group: 'Operación',
    label: 'Asignaciones',
    description: 'Organiza los turnos, módulos y periodos de cada observador.',
    path: '/asignaciones',
    permission: 'assignments:read',
    roles: [],
    icon: 'clipboard',
    create: {
      label: 'Crear asignación',
      path: '/asignaciones/nueva',
      permission: 'assignments:create',
    },
  },
  {
    id: 'attendance',
    group: 'Control de asistencia',
    label: 'Asistencias administrativas',
    description: 'Consulta las marcas, su revisión y la evidencia histórica.',
    path: '/asistencias',
    permission: 'attendance:read',
    roles: ['ADMIN', 'ENLACE'],
    icon: 'calendar',
  },
  {
    id: 'users',
    group: 'Administración',
    label: 'Cuentas',
    description: 'Gestiona el acceso y las cuentas de usuario del sistema.',
    path: '/cuentas',
    permission: 'users:read',
    roles: ['ADMIN'],
    icon: 'account',
    create: { label: 'Crear cuenta', path: '/cuentas/nueva', permission: 'users:create' },
  },
] as const;

export function availableSections(user: AuthUser | null) {
  if (!user) return [];
  return navigationSections.flatMap((section) => {
    if (section.roles.length && !(section.roles as readonly string[]).includes(user.role))
      return [];
    const canRead = user.permissions.includes(section.permission);
    const create =
      'create' in section && user.permissions.includes(section.create.permission)
        ? section.create
        : null;
    return canRead || create ? [{ ...section, canRead, create }] : [];
  });
}

export function sectionDestination(section: ReturnType<typeof availableSections>[number]) {
  return section.canRead ? { path: section.path, label: section.label } : section.create!;
}
