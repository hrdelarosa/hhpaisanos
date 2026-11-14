import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

export function createQueryClient(onPrivateError?: (error: Error) => void) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!query.meta?.public) onPrivateError?.(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.public) onPrivateError?.(error);
      },
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
}
