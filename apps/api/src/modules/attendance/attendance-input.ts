import { BadRequestException } from '@nestjs/common';
import { validate, version } from 'uuid';

export const missingLocationReasons = [
  'permission_denied',
  'position_unavailable',
  'timeout',
  'unsupported',
  'insecure_context',
  'unexpected_error',
] as const;
export type MissingLocationReason = (typeof missingLocationReasons)[number];
export type PersonalMark = {
  assignmentId: string;
  expectedDate: string;
  type: 'entrada' | 'salida';
  location:
    | { latitude: number; longitude: number; accuracy: number }
    | { missingReason: MissingLocationReason };
};

/** Fixed property order is also the canonical idempotency comparison. */
export function normalizeMark(value: PersonalMark): PersonalMark {
  const bad = () => {
    throw new BadRequestException('Invalid attendance content');
  };
  if (!value || typeof value !== 'object') return bad();
  if (
    Object.keys(value).some(
      (key) => !['assignmentId', 'expectedDate', 'type', 'location'].includes(key),
    )
  )
    return bad();
  if (
    typeof value.assignmentId !== 'string' ||
    !validate(value.assignmentId) ||
    version(value.assignmentId) !== 7
  )
    return bad();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.expectedDate) ||
    !Number.isFinite(Date.parse(`${value.expectedDate}T12:00:00Z`)) ||
    new Date(`${value.expectedDate}T12:00:00Z`).toISOString().slice(0, 10) !== value.expectedDate
  )
    return bad();
  if (value.type !== 'entrada' && value.type !== 'salida') return bad();
  const location = value.location;
  if (!location || typeof location !== 'object') return bad();
  let normalized: PersonalMark['location'];
  if ('missingReason' in location) {
    if (
      Object.keys(location).length !== 1 ||
      !missingLocationReasons.includes(location.missingReason)
    )
      return bad();
    normalized = { missingReason: location.missingReason };
  } else {
    if (
      Object.keys(location).sort().join(',') !== 'accuracy,latitude,longitude' ||
      ![location.latitude, location.longitude, location.accuracy].every(
        (n) => typeof n === 'number' && Number.isFinite(n),
      ) ||
      Math.abs(location.latitude) > 90 ||
      Math.abs(location.longitude) > 180 ||
      location.accuracy < 0 ||
      location.accuracy > 9999999.999999
    )
      return bad();
    normalized = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
    };
  }
  return {
    assignmentId: value.assignmentId.toLowerCase(),
    expectedDate: value.expectedDate,
    type: value.type,
    location: normalized,
  };
}
