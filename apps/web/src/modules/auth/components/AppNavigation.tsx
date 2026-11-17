import { Link, useLocation } from 'react-router';
import { Brand } from '../../../components/Brand';
import { Button } from '../../../components/ui/button';
import { NavigationIcon } from '../../../components/ui/navigation-icon';
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../../../components/ui/sidebar';
import { useSession } from '../hooks/use-session';
import { availableSections, sectionDestination } from '../utils/navigation';

export function AppNavigation() {
  const { user } = useSession();
  const { pathname: routePath } = useLocation();
  const { closeMobile, isMobile } = useSidebar();
  const pathname = routePath.toLowerCase().replace(/\/+$/u, '') || '/';
  const sections = availableSections(user);
  const groups = [...new Set(sections.map((section) => section.group))];

  return (
    <>
      <SidebarHeader className="flex-row items-center gap-1">
        <SidebarMenuButton
          size="lg"
          tooltip="Inicio de Paisanos"
          render={
            <Link to="/" onClick={closeMobile} aria-label="Inicio de Heroínas y Héroes Paisanos" />
          }
        >
          <Brand variant="compact" />
          <span className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate font-semibold">Heroínas y Héroes</span>
            <span className="truncate text-body-sm text-primary-foreground/70">
              Paisanos · INM Guerrero
            </span>
          </span>
        </SidebarMenuButton>
        {isMobile && (
          <Button
            variant="secondary"
            className="shrink-0 px-3"
            aria-label="Cerrar navegación"
            onClick={closeMobile}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </Button>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Inicio</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === '/'}
                  tooltip="Inicio"
                  render={<Link to="/" onClick={closeMobile} />}
                >
                  <NavigationIcon name="home" />
                  <span>Inicio</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {groups.map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections
                  .filter((section) => section.group === group)
                  .map((section) => {
                    const destination = sectionDestination(section);
                    const active =
                      pathname === destination.path ||
                      (section.canRead &&
                        section.id !== 'personal' &&
                        pathname.startsWith(section.path + '/'));

                    return (
                      <SidebarMenuItem key={section.id}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={destination.label}
                          render={<Link to={destination.path} onClick={closeMobile} />}
                        >
                          <NavigationIcon name={section.icon} />
                          <span className="truncate">{destination.label}</span>
                        </SidebarMenuButton>
                        {section.id === 'personal' && (
                          <SidebarMenuButton
                            isActive={pathname === '/mi-asistencia/historial'}
                            tooltip="Historial personal"
                            render={<Link to="/mi-asistencia/historial" onClick={closeMobile} />}
                          >
                            <NavigationIcon name="clipboard" />
                            <span>Historial personal</span>
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <p className="px-2 text-caption font-medium text-primary-foreground/70">INM Guerrero</p>
      </SidebarFooter>
    </>
  );
}
