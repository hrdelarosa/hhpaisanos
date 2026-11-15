import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useSession } from '../../auth/hooks/use-session';
import { CaptureRuntime } from '../api/capture-runtime';

const CaptureContext = createContext<CaptureRuntime | null>(null);

export function CaptureProvider({
  runtime,
  children,
}: {
  runtime: CaptureRuntime;
  children: ReactNode;
}) {
  const { user } = useSession();
  const client = useQueryClient();
  useLayoutEffect(() => {
    runtime.setSession(user, client);
    return () => runtime.setSession(null, client);
  }, [runtime, user, client]);
  return <CaptureContext value={runtime}>{children}</CaptureContext>;
}

export function useCapture() {
  const runtime = useContext(CaptureContext);
  if (!runtime) throw new Error('CaptureProvider is required');
  const { user } = useSession();
  const userId = user?.id ?? '';
  const state = useSyncExternalStore(runtime.subscribe, () => runtime.getState(userId));
  return {
    state,
    start: (operation: 'check-in' | 'check-out', assignmentId: string, date: string) =>
      runtime.start(userId, operation, assignmentId, date),
    retry: () => runtime.retry(userId),
  };
}
