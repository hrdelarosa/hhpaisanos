import type { ReactNode } from 'react';
import { Brand } from '../../../components/Brand';

export function AuthFrame({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'login';
}) {
  const login = variant === 'login';
  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-route-content
      className={`flex min-h-svh flex-col items-center justify-center p-4 py-8 wrap-anywhere sm:p-8 ${login ? '' : 'gap-6'}`}
    >
      <div className={`flex w-full max-w-auth flex-col ${login ? 'gap-3' : 'gap-6'}`}>
        <div className={`mx-auto w-64 max-w-full ${login ? '[&>img]:rounded-lg' : ''}`}>
          <Brand />
        </div>
        <section
          className={`flex flex-col rounded-lg border bg-card p-6 ${login ? 'gap-5' : 'gap-6 sm:p-8'}`}
        >
          {children}
        </section>
        <p
          className={`text-center ${login ? 'mt-1 text-caption font-medium' : 'text-body-sm'} text-muted-foreground`}
        >
          {login
            ? 'Oficina de Representación del Instituto Nacional de Migración en Guerrero'
            : 'Gestión operativa · Guerrero'}
        </p>
      </div>
    </main>
  );
}
