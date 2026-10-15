import { describe, expect, it } from 'vitest';
import { allocateSlug } from '../index';

describe('allocateSlug (І18: детермінований суфікс)', () => {
  it('вільна база повертається як є', () => {
    expect(allocateSlug('a', () => false)).toBe('a');
  });

  it("зайнята база → 'a-2', далі 'a-3'", () => {
    expect(allocateSlug('a', (t) => t === 'a')).toBe('a-2');
    expect(allocateSlug('a', (t) => ['a', 'a-2'].includes(t))).toBe('a-3');
  });

  it('пропущений суфікс не заповнюється заднім числом, але перший вільний береться', () => {
    expect(allocateSlug('a', (t) => ['a', 'a-3'].includes(t))).toBe('a-2');
  });

  it('детермінований: ті самі входи — той самий результат', () => {
    const taken = new Set(['a', 'a-2']);
    expect(allocateSlug('a', (t) => taken.has(t))).toBe(
      allocateSlug('a', (t) => taken.has(t)),
    );
  });

  it('предикат, що завжди «зайнято», не вішає процес', () => {
    expect(() => allocateSlug('a', () => true)).toThrow();
  });
});
