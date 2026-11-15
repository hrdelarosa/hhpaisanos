import { useState, type ReactNode } from 'react';
import { SessionProvider } from '../modules/auth/components/SessionProvider';
import { CaptureRuntime } from '../modules/attendance/api/capture-runtime';
import { CaptureProvider } from '../modules/attendance/components/CaptureProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  const [capture] = useState(() => new CaptureRuntime());
  return (
    <SessionProvider>
      <CaptureProvider runtime={capture}>{children}</CaptureProvider>
    </SessionProvider>
  );
}
