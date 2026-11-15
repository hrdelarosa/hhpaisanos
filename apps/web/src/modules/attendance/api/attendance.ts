import { http } from '../../../lib/http';
import { historySchema, todaySchema } from '../schemas/attendance';

export type HistoryFilters = { from: string; to: string; page: number; limit: number };

export async function getToday(signal: AbortSignal) {
  return todaySchema.parse(await http('/api/attendance/me/today', { signal }));
}

export async function getHistory(filters: HistoryFilters, signal: AbortSignal) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return historySchema.parse(await http(`/api/attendance/me?${params}`, { signal }));
}
