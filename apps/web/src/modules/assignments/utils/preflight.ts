import type { QueryClient } from '@tanstack/react-query';
import { observerQuery } from '../../observers/api/observers';
import { operativeQuery } from '../../operatives/api/operatives';
import { moduleQuery } from '../../attention-modules/api/attention-modules';
import type { CreateAssignment } from '../schemas/assignments';

export async function readResources(
  client: QueryClient,
  input: Pick<
    CreateAssignment,
    'observerId' | 'operativeId' | 'attentionModuleId' | 'validFrom' | 'validTo'
  >,
) {
  // Do not reuse a selector read that started before the administrative intention.
  await Promise.all([
    client.cancelQueries({ queryKey: observerQuery(input.observerId).queryKey, exact: true }),
    client.cancelQueries({ queryKey: operativeQuery(input.operativeId).queryKey, exact: true }),
    client.cancelQueries({ queryKey: moduleQuery(input.attentionModuleId).queryKey, exact: true }),
  ]);
  const [observer, operative, module] = await Promise.all([
    client.fetchQuery({ ...observerQuery(input.observerId), staleTime: 0 }),
    client.fetchQuery({ ...operativeQuery(input.operativeId), staleTime: 0 }),
    client.fetchQuery({ ...moduleQuery(input.attentionModuleId), staleTime: 0 }),
  ]);
  if (
    !observer.active ||
    !module.active ||
    operative.status === 'cerrado' ||
    input.validFrom < operative.startDate ||
    input.validTo > operative.endDate
  )
    throw new Error('ineligible');
  return { observer, operative, module };
}
export function sameSnapshot(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
