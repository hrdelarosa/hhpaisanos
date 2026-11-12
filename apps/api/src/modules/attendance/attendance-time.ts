const zone = 'America/Mexico_City';
const civil = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function localDate(instant: string): string {
  return civil.format(new Date(instant.replace(' ', 'T') + 'Z'));
}

/** Node's measured milliseconds, padded rather than invented microseconds. */
export function receivedAt(milliseconds: number): string {
  return new Date(milliseconds).toISOString().replace('T', ' ').replace('Z', '000');
}

export function instantMicros(instant: string): bigint {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/.test(instant))
    throw new Error('Expected UTC datetime with six fractional digits');
  const second = Date.parse(instant.slice(0, 19).replace(' ', 'T') + 'Z');
  if (!Number.isFinite(second) || receivedAt(second).slice(0, 19) !== instant.slice(0, 19))
    throw new Error('Invalid UTC datetime');
  return BigInt(second) * 1000n + BigInt(instant.slice(20));
}

export function scheduledInstant(date: string, time: string): string {
  const wall = Date.parse(`${date}T${time}Z`);
  let instant = wall;
  // Resolve the zone offset for the date, including historical Mexico City offsets.
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date(instant));
    const offset = parts.find((part) => part.type === 'timeZoneName')!.value;
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset);
    if (!match) throw new Error('Unsupported civil time offset');
    const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '+' ? 1 : -1);
    const next = wall - minutes * 60000;
    if (next === instant) return receivedAt(next);
    instant = next;
  }
  throw new Error('Ambiguous scheduled civil time');
}

export function timingFlags(
  event: string,
  date: string,
  type: 'entrada' | 'salida',
  start: string,
  end: string,
  tolerance: number,
) {
  const value = instantMicros(event);
  return {
    lateArrival:
      type === 'entrada' &&
      value > instantMicros(scheduledInstant(date, start)) + BigInt(tolerance) * 60000000n,
    earlyDeparture: type === 'salida' && value < instantMicros(scheduledInstant(date, end)),
  };
}
