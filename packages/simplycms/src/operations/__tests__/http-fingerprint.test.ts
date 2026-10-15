// Відбиток тіла запиту ідемпотентності канонічний: порядок ключів не важить.
import { describe, expect, it } from 'vitest';
import { fingerprintOf } from '../http/idempotency';

describe('fingerprintOf', () => {
  it('ті самі ключі в іншому порядку (і у вкладеному об’єкті) → той самий відбиток', () => {
    const a = { id: '1', name: 'n', nested: { x: 1, y: [{ b: 2, a: 1 }] } };
    const b = { nested: { y: [{ a: 1, b: 2 }], x: 1 }, name: 'n', id: '1' };
    expect(fingerprintOf(a).equals(fingerprintOf(b))).toBe(true);
  });

  it('інше значення → інший відбиток; порядок елементів масиву значущий', () => {
    expect(fingerprintOf({ a: 1 }).equals(fingerprintOf({ a: 2 }))).toBe(false);
    expect(fingerprintOf([1, 2]).equals(fingerprintOf([2, 1]))).toBe(false);
  });
});
