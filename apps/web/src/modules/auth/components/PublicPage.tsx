import type { ReactNode } from 'react';
import { useSession } from '../hooks/use-session';
import { AuthFrame } from './AuthFrame';
import { AuthenticatedLayout } from './AuthenticatedLayout';

// Public status/not-found routes may use the shell only after identity is verified.
export function PublicPage({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  return status === 'authenticated' && !user?.mustChangePassword ? (
    <AuthenticatedLayout>{children}</AuthenticatedLayout>
  ) : (
    <AuthFrame>{children}</AuthFrame>
  );
}
