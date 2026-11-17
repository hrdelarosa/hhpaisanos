import { Link } from 'react-router';
import { NavigationIcon } from '../../../components/ui/navigation-icon';
import { cn } from '../../../lib/utils';
import { useSession } from '../hooks/use-session';
import { availableSections, sectionDestination } from '../utils/navigation';

export function SessionHomePage() {
  const { user } = useSession();
  const sections = availableSections(user);
  const groups = [...new Set(sections.map((section) => section.group))];
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 border-b pb-6">
        <h1 className="text-heading">Inicio</h1>
        <p className="text-subheading">
          {user?.fullName} · {user?.role}
        </p>
        <p className="max-w-form text-foreground-secondary">
          Bienvenido a tu espacio de trabajo. Elige una herramienta para continuar.
        </p>
        <p className="text-body-sm text-muted-foreground">Ámbito operativo: Guerrero.</p>
      </header>
      <nav aria-label="Secciones autorizadas" className="grid gap-8 lg:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group}
            className={cn(
              'flex min-w-0 flex-col gap-4',
              (group === 'Operación' || group === 'Mi asistencia') && 'lg:col-span-2',
            )}
          >
            <h2 className="text-heading-sm">{group}</h2>
            <div className={cn('grid gap-4', group === 'Operación' && 'md:grid-cols-2')}>
              {sections
                .filter((section) => section.group === group)
                .map((section) => {
                  const destination = sectionDestination(section);
                  return (
                    <article
                      key={section.id}
                      className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-6"
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded-md bg-secondary p-3 text-secondary-foreground">
                          <NavigationIcon name={section.icon} />
                        </span>
                        <h3 className="text-subheading">{section.label}</h3>
                      </div>
                      <p className="flex-1 text-body-sm text-foreground-secondary">
                        {section.canRead
                          ? section.description
                          : 'Tienes acceso al registro de nuevos datos en esta sección.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-6">
                        <Link
                          to={destination.path}
                          className="inline-flex min-h-touch items-center gap-3 text-label text-primary underline"
                        >
                          {section.canRead
                            ? section.id === 'personal'
                              ? 'Ver mi asistencia de hoy'
                              : `Abrir ${section.label.toLocaleLowerCase('es')}`
                            : destination.label}
                          <NavigationIcon name="arrow" />
                        </Link>
                        {section.canRead && section.create && (
                          <Link
                            to={section.create.path}
                            className="inline-flex min-h-touch items-center text-body-sm text-primary underline"
                          >
                            {section.create.label}
                          </Link>
                        )}
                        {section.id === 'personal' && (
                          <Link
                            to="/mi-asistencia/historial"
                            className="inline-flex min-h-touch items-center text-body-sm text-primary underline"
                          >
                            Consultar mi historial
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
        {!sections.length && (
          <section className="flex flex-col gap-2 rounded-lg border bg-card p-6 lg:col-span-2">
            <h2 className="text-heading-sm">Sin herramientas disponibles</h2>
            <p className="text-foreground-secondary">
              No tienes permisos para las secciones operativas. Las acciones de tu cuenta siguen
              disponibles en la navegación.
            </p>
          </section>
        )}
      </nav>
    </div>
  );
}
