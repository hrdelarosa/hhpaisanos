import { queryOptions } from '@tanstack/react-query';
import { http } from '../../../lib/http';
import { observerSchema, observerListSchema, type CreateObserverInput } from '../schemas/observers';

export const observersKey = ['observers'] as const;
export type ObserverFilters = {
  search: string;
  active: string;
  linked: string;
  page: number;
  pageSize: number;
};
export function observerQuery(id: string) {
  return queryOptions({
    queryKey: [...observersKey, 'detail', id],
    queryFn: async ({ signal }) =>
      observerSchema.parse(await http(`/api/observers/${id}`, { signal })),
  });
}
export async function listObservers(filters: ObserverFilters, signal: AbortSignal) {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  for (const key of ['search', 'active', 'linked'] as const)
    if (filters[key]) params.set(key, filters[key]);
  return observerListSchema.parse(await http(`/api/observers?${params}`, { signal }));
}
export async function createObserver(input: CreateObserverInput) {
  const observer = observerSchema.parse(
    await http('/api/observers', {
      method: 'POST',
      body: { ...input, phone: input.phone === '' ? null : input.phone },
    }),
  );
  if (!observer.active || observer.userId !== null) throw new Error('unexpected_creation_response');
  return observer;
}
export async function editObserver(
  id: string,
  input: {
    firstNames?: string;
    lastNames?: string;
    phone?: string | null;
    reason: string;
  },
) {
  await http(`/api/observers/${id}`, { method: 'PATCH', body: input });
}
export async function changeObserverStatus(id: string, input: { active: boolean; reason: string }) {
  await http(`/api/observers/${id}/status`, { method: 'PATCH', body: input });
}
