import { expect, it } from 'vite-plus/test';
import { v7 } from 'uuid';
import { binaryToUuid, uuidToBinary } from '../dist/database/schema/uuid.js';

it('preserves UUIDv7 bytes without swapping', () => {
  const value = v7();
  expect(uuidToBinary(value).toString('hex')).toBe(value.replaceAll('-', ''));
  expect(binaryToUuid(uuidToBinary(value))).toBe(value);
});

it.each([
  'invalid',
  '',
  '00000000-0000-0000-0000-000000000000',
  '550e8400-e29b-41d4-a716-446655440000',
  '019a0000-0000-7000-0711-000000000000',
])('rejects invalid/non-v7 UUIDs: %s', (value) => {
  expect(() => uuidToBinary(value)).toThrow();
});

it('rejects invalid binary lengths and non-v7 binary values', () => {
  expect(() => binaryToUuid(Buffer.alloc(15))).toThrow();
  expect(() => binaryToUuid(Buffer.alloc(17))).toThrow();
  expect(() => binaryToUuid(Buffer.alloc(16))).toThrow();
});
