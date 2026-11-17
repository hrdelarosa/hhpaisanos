import type { ReactNode } from 'react';
import { Brand } from '../../../components/Brand';

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-route-content
      className="flex min-h-svh flex-col items-center justify-center gap-6 p-4 py-8 wrap-anywhere sm:p-8"
    >
      <div className="flex w-full max-w-auth flex-col gap-6">
        <div className="mx-auto w-64 max-w-full">
          <Brand />
        </div>
        <section className="flex flex-col gap-6 rounded-lg border bg-card p-6 sm:p-8">
          {children}
        </section>
        <p className="text-center text-body-sm text-muted-foreground">
          Gestión operativa · Guerrero
        </p>
      </div>
    </main>
  );
}
