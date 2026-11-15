import { z } from 'zod';
import { http } from '../../../lib/http';

const linkableAccountSchema = z.object({
  id: z.uuidv7(),
  username: z.string(),
  fullName: z.string(),
});
export type LinkableAccount = z.infer<typeof linkableAccountSchema>;
export async function findLinkableAccount(username: string, signal?: AbortSignal) {
  return linkableAccountSchema.parse(
    await http(`/api/observers/linkable-account?${new URLSearchParams({ username })}`, { signal }),
  );
}
export async function linkObserverAccount(id: string, userId: string, reason: string) {
  await http(`/api/observers/${id}/account`, {
    method: 'PUT',
    body: { userId, verificationMethod: 'supervised_administrative', reason },
  });
}
