import { ValidateBy } from 'class-validator';

// Built-in length validators ignore some variation selectors; count every code point instead.
export function CodePointLength(min: number, max: number): PropertyDecorator {
  return ValidateBy({
    name: 'codePointLength',
    constraints: [min, max],
    validator: {
      validate: (value: unknown) => {
        if (typeof value !== 'string') return false;
        const length = Array.from(value).length;
        return length >= min && length <= max;
      },
    },
  });
}

// Buffer preserves the existing UTF-8 byte semantics, including unpaired surrogates.
export function MaxUtf8Bytes(max: number): PropertyDecorator {
  return ValidateBy({
    name: 'maxUtf8Bytes',
    constraints: [max],
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= max,
    },
  });
}
