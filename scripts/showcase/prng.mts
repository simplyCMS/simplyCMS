/**
 * Детермінований PRNG сіду вітрини (С-6).
 *
 * 🔴 Свій генератор, а не `Math.random`: однаковий seed мусить давати
 * однакові назви, email-и, кількості й суми на будь-якій машині — на цьому
 * стоїть гейт детермінованості (С-8б). uuid і абсолютний час свідомо НЕ
 * детерміновані: ключ генерує викликач, час рахується від запуску.
 */

/** Фіксований seed сіду. Зміна значення змінює ВЕСЬ знімок демо-бази. */
export const SHOWCASE_SEED = 20261008;

/** Генератор рівномірних чисел у `[0, 1)`. */
export type Rand = () => number;

/**
 * mulberry32: 32-бітний стан, достатній період для сотень сутностей і
 * однаковий результат у будь-якому рушії JS (лише `Math.imul` і зсуви).
 */
export function prng(seed: number): Rand {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ціле в замкненому діапазоні `[min, max]`. */
export function int(rand: Rand, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`int: некоректний діапазон [${min}, ${max}]`);
  }
  return min + Math.floor(rand() * (max - min + 1));
}

/** Випадковий елемент непорожнього списку. */
export function pick<T>(rand: Rand, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('pick: порожній список');
  return items[int(rand, 0, items.length - 1)] as T;
}
