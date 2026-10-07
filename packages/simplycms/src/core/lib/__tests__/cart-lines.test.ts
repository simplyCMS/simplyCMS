import { describe, expect, it } from 'vitest';
import { quoteCartInputSchema } from '../cart-lines';

/**
 * Вхід `quoteCart` (Е6в-13): та сама межа, що в кошика й чекауту. Порожній
 * масив валідний — сервер відповідає нульовою квотою без звернення до БД.
 */
const P = '10000002-0000-4000-8000-000000000001';
const M = '10000003-0000-4000-8000-000000000001';
const uuid = (i: number) =>
  `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const ok = (items: unknown[]) =>
  quoteCartInputSchema.safeParse({ items }).success;

describe('quoteCartInputSchema', () => {
  it('порожній кошик і звичайні рядки — так', () => {
    expect(ok([])).toBe(true);
    expect(
      ok([
        { productId: P, modificationId: null, quantity: 1 },
        { productId: P, modificationId: M, quantity: 999 },
      ]),
    ).toBe(true);
  });

  it.each([
    ['кількість 0', { productId: P, modificationId: null, quantity: 0 }],
    ['кількість 1000', { productId: P, modificationId: null, quantity: 1000 }],
    [
      'дробова кількість',
      { productId: P, modificationId: null, quantity: 1.5 },
    ],
    ['не UUID', { productId: 'x', modificationId: null, quantity: 1 }],
  ])('%s — помилка', (_case, row) => {
    expect(ok([row])).toBe(false);
  });

  it('дубль пари (productId, modificationId) — помилка', () => {
    expect(
      ok([
        { productId: P, modificationId: M, quantity: 1 },
        { productId: P, modificationId: M, quantity: 2 },
      ]),
    ).toBe(false);
  });

  it('101 рядок — помилка', () => {
    const rows = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        productId: uuid(i + 1),
        modificationId: null,
        quantity: 1,
      }));
    expect(ok(rows(100))).toBe(true);
    expect(ok(rows(101))).toBe(false);
  });
});
