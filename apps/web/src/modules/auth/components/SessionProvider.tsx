import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { getCurrentUser, sessionKey } from '../api/auth';
import { SessionRuntime, sessionIdentity, type SessionScope } from '../api/session-runtime';
import { SessionContext, type Session } from '../hooks/use-session';
import type { AuthUser } from '../schemas/auth';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [runtime] = useState(() => new SessionRuntime());
  const { scope, busy, actionError } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  return (
    <QueryClientProvider client={scope.client} key={scope.revision}>
      <SessionState
        scope={scope}
        busy={busy}
        actionError={actionError}
        accept={(user) => runtime.accept(user, scope.client)}
        login={runtime.login}
        logout={runtime.logout}
        changePassword={runtime.changePassword}
        recheck={runtime.recheck}
      >
        {children}
      </SessionState>
    </QueryClientProvider>
  );
}

function SessionState({
  scope,
  accept,
  children,
  ...actions
}: {
  scope: SessionScope;
  accept: (user: AuthUser) => void;
  children: ReactNode;
} & Pick<Session, 'busy' | 'actionError' | 'login' | 'logout' | 'changePassword' | 'recheck'>) {
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => getCurrentUser(signal),
    enabled: scope.phase === 'checking' || scope.phase === 'ready',
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  const matches = query.data !== undefined && sessionIdentity(query.data) === scope.identity;
  useEffect(() => {
    if (query.isSuccess && !query.isFetching && (!matches || scope.phase === 'checking'))
      accept(query.data);
  }, [query.data, query.isSuccess, query.isFetching, matches, scope.phase, accept]);
  const status: Session['status'] =
    scope.phase === 'signedOut'
      ? 'anonymous'
      : scope.phase === 'logoutFailed'
        ? 'logoutFailed'
        : scope.phase === 'signingOut' || query.isPending || query.isFetching
          ? 'loading'
          : query.isError
            ? 'error'
            : !matches
              ? 'loading'
              : 'authenticated';
  return (
    <SessionContext
      value={{
        ...actions,
        status,
        user: status === 'authenticated' ? query.data! : null,
        notice: scope.notice,
      }}
    >
      {children}
    </SessionContext>
  );
}
