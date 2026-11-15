import { queryOptions } from '@tanstack/react-query';
import { http } from '../../../lib/http';
import {
  assignmentSchema,
  assignmentListSchema,
  type AssignmentFilters,
  type CreateAssignment,
  type Operation,
} from '../schemas/assignments';

export const assignmentsKey = ['assignments'] as const;
export function assignmentQuery(id: string) {
  return queryOptions({
    queryKey: [...assignmentsKey, 'detail', id],
    queryFn: async ({ signal }) =>
      assignmentSchema.parse(await http(`/api/assignments/${id}`, { signal })),
  });
}
export async function listAssignments(filters: AssignmentFilters, signal: AbortSignal) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== '') params.set(key, String(value));
  return assignmentListSchema.parse(await http(`/api/assignments?${params}`, { signal }));
}
export async function createAssignment(input: CreateAssignment) {
  return assignmentSchema.parse(await http('/api/assignments', { method: 'POST', body: input }));
}
export async function modifyAssignment(
  id: string,
  operation: Operation,
  body: Record<string, unknown>,
) {
  const result = await http(`/api/assignments/${id}/${operation}`, { method: 'POST', body });
  // A no-op change, termination and cancellation return 204; a split returns the new period.
  return result === undefined ? undefined : assignmentSchema.parse(result);
}
