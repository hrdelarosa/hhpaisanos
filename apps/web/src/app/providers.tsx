import type { ReactNode } from 'react';
import { SessionProvider } from '../modules/auth/components/SessionProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
