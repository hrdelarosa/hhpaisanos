import { z } from 'zod';
import { http } from '../../../lib/http';

const healthSchema = z.object({ status: z.literal('ok') });

export async function getHealth(signal: AbortSignal) {
  return healthSchema.parse(await http('/api/health', { signal }));
}
