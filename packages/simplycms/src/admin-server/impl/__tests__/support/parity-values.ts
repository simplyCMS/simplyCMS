import type { Column } from 'drizzle-orm';

const UUID = '3f6c2d1e-9b7a-4c5d-8e2f-1a2b3c4d5e6f';

/** Значення, на яких гейт паритету порівнює дві реалізації схем. */
export const BASE_VALUES: readonly unknown[] = [
  undefined,
  null,
  '',
  'x',
  'a'.repeat(255),
  'a'.repeat(256),
  'a'.repeat(10_001),
  UUID,
  UUID.toUpperCase(),
  'not-a-uuid',
  0,
  1,
  -1,
  1.5,
  2147483647,
  2147483648,
  -2147483648,
  -2147483649,
  Number.MAX_SAFE_INTEGER,
  NaN,
  Infinity,
  true,
  false,
  'true',
  new Date(),
  new Date('invalid'),
  '2026-01-01T00:00:00.000Z',
  {},
  [],
  ['a'],
  { a: 1 },
  { a: { b: [1, null] } },
  '1.50',
  '-0.5',
  'abc',
];

/** Базові значення + специфічні для колонки: enum-члени, чужий рядок, `n` / `n+1` для varchar. */
export function valuesFor(column: Column): unknown[] {
  const extra: unknown[] = ['__foreign__'];
  if ('enumValues' in column && Array.isArray(column.enumValues)) {
    extra.push(...column.enumValues);
  }
  if ('length' in column && typeof column.length === 'number') {
    extra.push('a'.repeat(column.length), 'a'.repeat(column.length + 1));
  }
  return [...BASE_VALUES, ...extra];
}
