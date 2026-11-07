import { customType } from 'drizzle-orm/mysql-core';
import { parse, stringify, validate, version, v7 } from 'uuid';

export function uuidToBinary(value: string): Buffer {
  if (!validate(value) || version(value) !== 7) throw new Error('Expected a UUIDv7 identifier');
  return Buffer.from(parse(value));
}

export function binaryToUuid(value: Buffer): string {
  if (!Buffer.isBuffer(value) || value.length !== 16) throw new Error('Expected 16 UUID bytes');
  const uuid = stringify(value);
  uuidToBinary(uuid);
  return uuid;
}

export const uuid = customType<{ data: string; driverData: Buffer }>({
  dataType: () => 'binary(16)',
  toDriver: uuidToBinary,
  fromDriver: binaryToUuid,
});

export const id = () => uuid('id').primaryKey().$defaultFn(v7);
