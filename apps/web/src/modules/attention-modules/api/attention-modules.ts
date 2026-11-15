import { queryOptions } from '@tanstack/react-query';
import { http } from '../../../lib/http';
import {
  moduleSchema,
  moduleListSchema,
  type CreateModuleInput,
  type EditModuleInput,
} from '../schemas/attention-modules';

export const modulesKey = ['attention-modules'] as const;
export type ModuleFilters = {
  name: string;
  municipality: string;
  active: string;
  page: number;
  limit: number;
};
export function moduleQuery(id: string) {
  return queryOptions({
    queryKey: [...modulesKey, 'detail', id],
    queryFn: async ({ signal }) =>
      moduleSchema.parse(await http(`/api/attention-modules/${id}`, { signal })),
  });
}
export async function listModules(filters: ModuleFilters, signal: AbortSignal) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
  for (const key of ['name', 'municipality', 'active'] as const)
    if (filters[key]) params.set(key, filters[key]);
  return moduleListSchema.parse(await http(`/api/attention-modules?${params}`, { signal }));
}
export async function createModule(input: CreateModuleInput) {
  const module = moduleSchema.parse(
    await http('/api/attention-modules', { method: 'POST', body: input }),
  );
  if (!module.active) throw new Error('Unexpected creation state');
  return module;
}
export async function editModule(
  id: string,
  input: Partial<Pick<EditModuleInput, 'name' | 'municipality'>> & { reason: string },
) {
  await http(`/api/attention-modules/${id}`, { method: 'PATCH', body: input });
}
export async function changeModuleStatus(id: string, input: { active: boolean; reason: string }) {
  await http(`/api/attention-modules/${id}/status`, { method: 'PATCH', body: input });
}
