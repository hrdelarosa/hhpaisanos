import { queryOptions } from '@tanstack/react-query';
import { http } from '../../../lib/http';
import {
  operativeSchema,
  operativeListSchema,
  type CreateOperativeInput,
  type ActivationInput,
} from '../schemas/operatives';

export type OperativeFilters = { name: string; status: string; page: number; limit: number };
export const operativesKey = ['operatives'] as const;
export function operativeQuery(id: string) {
  return queryOptions({
    queryKey: [...operativesKey, 'detail', id],
    queryFn: async ({ signal }) =>
      operativeSchema.parse(await http(`/api/operatives/${id}`, { signal })),
  });
}
export async function listOperatives(filters: OperativeFilters, signal: AbortSignal) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
  if (filters.name) params.set('name', filters.name);
  if (filters.status) params.set('status', filters.status);
  return operativeListSchema.parse(await http(`/api/operatives?${params}`, { signal }));
}
export async function createOperative(input: CreateOperativeInput) {
  const operative = operativeSchema.parse(
    await http('/api/operatives', { method: 'POST', body: input }),
  );
  if (operative.status !== 'borrador') throw new Error('Unexpected creation state');
  return operative;
}
export async function activateOperative(id: string, input: ActivationInput) {
  await http(`/api/operatives/${id}/activate`, { method: 'POST', body: input });
}
