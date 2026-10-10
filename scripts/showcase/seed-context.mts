/**
 * Спільне для модулів наповнення: контекст прогону і потоки PRNG.
 *
 * 🔴 Окремий потік PRNG на модуль (`stream`), а не один на весь сід: правка
 * одного модуля (ще одна властивість, інша кількість відгуків) інакше зсунула
 * б послідовність у всіх наступних і змінила б знімок цілком (С-6).
 */
import type { MediaStorageDriver } from '../../packages/simplycms/src/storage/index.ts';
import { prng, SHOWCASE_SEED, type Rand } from './prng.mts';

/** Номери потоків — фіксовані: перестановка викликів їх не зсуває. */
export const STREAM = {
  catalog: 1,
  images: 2,
  prices: 3,
  stock: 4,
  people: 5,
  orders: 6,
  reviews: 7,
} as const;

export function stream(name: keyof typeof STREAM): Rand {
  return prng(SHOWCASE_SEED + STREAM[name] * 7919);
}

/** Що знає кожен крок наповнення. */
export type SeedContext = {
  /** Явний драйвер медіатеки (не кешований `getMediaDriver()`). */
  readonly media: MediaStorageDriver;
  /** Власник магазину: автор завантажень і ручних дій адміна. */
  readonly ownerId: string;
};

/** Сума в гривнях → рядок `numeric` (`MONEY_RE`). */
export const money = (uah: number): string => uah.toFixed(2);

/** Ціле з кроком: 12345 з кроком 50 → 12350. */
export const roundTo = (value: number, step: number): number =>
  Math.round(value / step) * step;
