import { queryOptions } from '@tanstack/react-query';
import { http } from '../../../lib/http';
import {
  createdUserSchema,
  rolesSchema,
  userListSchema,
  userSchema,
  type CreateUserInput,
} from '../schemas/users';

export const usersKey = ['users'] as const;
export const rolesQuery = queryOptions({
  queryKey: [...usersKey, 'roles'],
  queryFn: async ({ signal }) => rolesSchema.parse(await http('/api/roles', { signal })),
});
export function userQuery(id: string) {
  return queryOptions({
    queryKey: [...usersKey, 'detail', id],
    queryFn: async ({ signal }) => userSchema.parse(await http(`/api/users/${id}`, { signal })),
  });
}
export type UserFilters = {
  search: string;
  active: string;
  roleId: string;
  page: number;
  pageSize: number;
};
export async function listUsers(filters: UserFilters, signal: AbortSignal) {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  for (const key of ['search', 'active', 'roleId'] as const)
    if (filters[key]) params.set(key, filters[key]);
  return userListSchema.parse(await http(`/api/users?${params}`, { signal }));
}
// Credentials deliberately bypass TanStack Query's caches.
export async function createUser(input: CreateUserInput) {
  return createdUserSchema.parse(await http('/api/users', { method: 'POST', body: input }));
}
export async function editUser(id: string, input: { fullName: string; reason: string }) {
  await http(`/api/users/${id}`, { method: 'PATCH', body: input });
}
export async function changeUserStatus(id: string, input: { active: boolean; reason: string }) {
  await http(`/api/users/${id}/status`, { method: 'PATCH', body: input });
}
