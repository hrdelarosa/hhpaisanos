import { z } from 'zod';
import { http } from '../../../lib/http';
import {
  administrativeDetailSchema,
  administrativeHistorySchema,
  administrativeListSchema,
  type AdministrativeFilters,
  type ReviewInput,
} from '../schemas/administration';

export const administrativeAttendanceKey = ['attendance', 'administration'] as const;
// Do not retain Zod errors that could contain private evidence from a response.
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('Respuesta de asistencia inválida.');
  return result.data;
}
export async function listAdministrativeAttendance(
  filters: AdministrativeFilters,
  signal: AbortSignal,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== '') params.set(key, String(value));
  return parse(administrativeListSchema, await http(`/api/attendance?${params}`, { signal }));
}
export const administrativeDetailQuery = (id: string) => ({
  queryKey: [...administrativeAttendanceKey, 'detail', id],
  queryFn: async ({ signal }: { signal: AbortSignal }) =>
    parse(administrativeDetailSchema, await http(`/api/attendance/${id}`, { signal })),
  gcTime: 0,
});
export async function getAdministrativeHistory(id: string, page: number, signal: AbortSignal) {
  return parse(
    administrativeHistorySchema,
    await http(`/api/attendance/${id}/history?page=${page}&limit=20`, { signal }),
  );
}
export async function reviewAttendance(id: string, input: ReviewInput, expectedVersion: number) {
  return parse(
    z.object({
      id: z.literal(id),
      version: z.literal(expectedVersion),
      reviewStatus: z.literal(input.decision === 'accept' ? 'accepted_administrative' : 'rejected'),
    }),
    await http(`/api/attendance/${id}/review`, {
      method: 'POST',
      body: { ...input, expectedVersion },
    }),
  );
}
