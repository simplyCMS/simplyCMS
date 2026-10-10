// PRNG сіду вітрини (С-6): однаковий seed → однакова послідовність. На цьому
// стоїть гейт детермінованості демо-бази (С-8б), тож перевіряється окремо.
import { describe, expect, it } from 'vitest';
import { int, pick, prng, SHOWCASE_SEED } from '../scripts/showcase/prng.mts';

const take = (rand: () => number, n: number): number[] =>
  Array.from({ length: n }, () => rand());

describe('prng сіду вітрини', () => {
  it('однаковий seed дає однакову послідовність', () => {
    expect(take(prng(SHOWCASE_SEED), 50)).toEqual(
      take(prng(SHOWCASE_SEED), 50),
    );
  });

  it('різні seed-и дають різні послідовності', () => {
    expect(take(prng(1), 10)).not.toEqual(take(prng(2), 10));
  });

  it('значення в [0, 1)', () => {
    for (const value of take(prng(SHOWCASE_SEED), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int тримається замкненого діапазону й досягає обох меж', () => {
    const rand = prng(7);
    const seen = new Set(Array.from({ length: 500 }, () => int(rand, 3, 6)));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
    expect(() => int(rand, 5, 4)).toThrow(RangeError);
  });

  it('pick детермінований і відмовляє на порожньому списку', () => {
    const items = ['a', 'b', 'c', 'd'] as const;
    const draw = (rand: () => number): string[] =>
      Array.from({ length: 20 }, () => pick(rand, items));
    expect(draw(prng(9))).toEqual(draw(prng(9)));
    expect(() => pick(prng(1), [])).toThrow(RangeError);
  });
});
