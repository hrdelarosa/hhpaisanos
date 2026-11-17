import { cloneElement, createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';
import { NavigationIcon } from './navigation-icon';

type SidebarContextValue = {
  isMobile: boolean;
  open: boolean;
  setOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  closeMobile: () => void;
  sidebarRef: RefObject<HTMLElement | null>;
  dialogRef: RefObject<HTMLDialogElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('Sidebar components must be used inside SidebarProvider.');
  return context;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia?.('(max-width: 1023px)').matches ?? false,
  );
  const [open, setOpen] = useState(true);
  const [openMobile, setOpenMobile] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sidebarHadFocus = useRef(false);

  const closeMobile = () => {
    setOpenMobile(false);
    if (dialogRef.current?.open) dialogRef.current.close();
  };

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 1024px)');
    if (!media) return;
    const change = () => {
      if (dialogRef.current?.open) dialogRef.current.close();
      setOpenMobile(false);
      setIsMobile(!media.matches);
      if (sidebarHadFocus.current) triggerRef.current?.focus();
      sidebarHadFocus.current = false;
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  const value: SidebarContextValue = {
    isMobile,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    closeMobile,
    sidebarRef,
    dialogRef,
    triggerRef,
  };

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        className="group/sidebar-wrapper flex min-h-svh w-full min-w-0"
        onFocusCapture={(event) => {
          sidebarHadFocus.current =
            sidebarRef.current?.contains(event.target) === true ||
            dialogRef.current?.contains(event.target) === true;
        }}
        onPointerDownCapture={(event) => {
          if (
            event.target instanceof Node &&
            !sidebarRef.current?.contains(event.target) &&
            !dialogRef.current?.contains(event.target)
          ) {
            sidebarHadFocus.current = false;
          }
        }}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ children }: { children: ReactNode }) {
  const { isMobile, open, openMobile, setOpenMobile, sidebarRef, dialogRef } = useSidebar();

  useEffect(() => {
    if (!isMobile || !openMobile || !dialogRef.current || dialogRef.current.open) return;
    dialogRef.current.showModal();
  }, [dialogRef, isMobile, openMobile]);

  if (isMobile) {
    return (
      <dialog
        ref={dialogRef}
        id="mobile-navigation"
        data-slot="sidebar"
        aria-labelledby="mobile-navigation-title"
        className="mobile-navigation fixed inset-y-0 left-0 m-0 h-svh max-h-none w-[min(18rem,calc(100vw-2rem))] max-w-none border-0 bg-primary-hover p-0 text-primary-foreground backdrop:bg-black/50"
        onClose={() => setOpenMobile(false)}
      >
        <div className="flex h-full min-h-0 flex-col">
          <h2 id="mobile-navigation-title" className="sr-only">
            Navegación principal
          </h2>
          {children}
        </div>
      </dialog>
    );
  }

  return (
    <aside
      ref={sidebarRef}
      id="desktop-navigation"
      data-slot="sidebar"
      data-state={open ? 'expanded' : 'collapsed'}
      aria-label="Barra lateral"
      hidden={!open}
      className="sidebar-desktop sticky top-0 flex h-svh w-sidebar shrink-0 flex-col overflow-y-auto bg-primary-hover text-primary-foreground"
    >
      <div className="flex min-h-full flex-col">{children}</div>
    </aside>
  );
}

export function SidebarHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="sidebar-header" className={cn('flex flex-col gap-2 p-3', className)}>
      {children}
    </div>
  );
}

export function SidebarContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="sidebar-content" className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
      {children}
    </div>
  );
}

export function SidebarFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn('mt-auto border-t border-primary p-3', className)}
    >
      {children}
    </div>
  );
}

export function SidebarGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section data-slot="sidebar-group" className={cn('flex min-w-0 flex-col gap-2 p-2', className)}>
      {children}
    </section>
  );
}

export function SidebarGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="sidebar-group-label"
      className="px-3 text-body-sm font-medium text-primary-foreground/70"
    >
      {children}
    </div>
  );
}

export function SidebarGroupContent({ children }: { children: ReactNode }) {
  return <div data-slot="sidebar-group-content">{children}</div>;
}

export function SidebarMenu({ children }: { children: ReactNode }) {
  return (
    <ul data-slot="sidebar-menu" className="flex w-full min-w-0 flex-col gap-1">
      {children}
    </ul>
  );
}

export function SidebarMenuItem({ children }: { children: ReactNode }) {
  return (
    <li data-slot="sidebar-menu-item" className="group/menu-item relative">
      {children}
    </li>
  );
}

type SidebarLinkProps = {
  className?: string;
  title?: string;
  'aria-current'?: 'page' | undefined;
};

export function SidebarMenuButton({
  render,
  isActive = false,
  tooltip,
  size = 'default',
  children,
}: {
  render: ReactElement<SidebarLinkProps>;
  isActive?: boolean;
  tooltip?: string;
  size?: 'default' | 'lg';
  children: ReactNode;
}) {
  const link = render as ReactElement<SidebarLinkProps>;
  return cloneElement(
    link,
    {
      className: cn(
        'sidebar-menu-button flex min-h-touch w-full min-w-0 items-center gap-3 rounded-md px-3 text-left text-label transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-inverse',
        size === 'lg' && 'min-h-14 px-2',
        isActive && 'bg-secondary font-semibold text-secondary-foreground hover:bg-secondary',
        link.props.className,
      ),
      'aria-current': isActive ? 'page' : link.props['aria-current'],
      title: tooltip ?? link.props.title,
    },
    children,
  );
}

export function SidebarInset({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="sidebar-inset"
      className={cn('flex min-h-svh min-w-0 flex-1 flex-col bg-background', className)}
    >
      {children}
    </div>
  );
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { isMobile, open, setOpen, openMobile, setOpenMobile, dialogRef, triggerRef } =
    useSidebar();
  return (
    <Button
      ref={triggerRef}
      variant="secondary"
      className={cn('shrink-0 px-3', className)}
      aria-label="Alternar barra lateral"
      aria-expanded={isMobile ? openMobile : open}
      aria-controls={isMobile ? 'mobile-navigation' : 'desktop-navigation'}
      onClick={() => {
        if (isMobile) {
          setOpenMobile(true);
          if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
        } else {
          setOpen((current) => !current);
        }
      }}
    >
      <NavigationIcon name="menu" />
    </Button>
  );
}
