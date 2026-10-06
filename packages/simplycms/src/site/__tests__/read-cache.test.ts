import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReadCache } from '../read-cache';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createReadCache', () => {
  it('другий get у межах TTL не кличе load', async () => {
    const cache = createReadCache<number>(1000);
    const load = vi.fn(async () => 1);
    await cache.get(load);
    expect(await cache.get(load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('після invalidate() load кличеться знову', async () => {
    const cache = createReadCache<number>(1000);
    const load = vi.fn(async () => 1);
    await cache.get(load);
    cache.invalidate();
    await cache.get(load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('після спливу TTL load кличеться знову', async () => {
    const cache = createReadCache<number>(1000);
    const load = vi.fn(async () => 1);
    await cache.get(load);
    vi.advanceTimersByTime(1001);
    await cache.get(load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('помилка load не кешується й пропускається далі', async () => {
    const cache = createReadCache<number>(1000);
    await expect(
      cache.get(async () => {
        throw new Error('db down');
      }),
    ).rejects.toThrow('db down');
    const load = vi.fn(async () => 2);
    expect(await cache.get(load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  // Review Focus 3 (Е6б-9): читання стартувало до скидання, завершилось після.
  it('читання, що було в польоті під час invalidate(), не кешує старе значення', async () => {
    const cache = createReadCache<string>(60_000);
    let resolveOld!: (v: string) => void;
    const pending = cache.get(
      () => new Promise<string>((resolve) => (resolveOld = resolve)),
    );

    cache.invalidate();
    resolveOld('старе');
    // Саме читання віддає те, що прочитало, — стара відповідь допустима
    // для запиту, який стартував раніше.
    expect(await pending).toBe('старе');

    const load2 = vi.fn(async () => 'нове');
    expect(await cache.get(load2)).toBe('нове');
    expect(load2).toHaveBeenCalledTimes(1);
  });

  it('нульовий або відʼємний TTL відхиляється', () => {
    expect(() => createReadCache(0)).toThrow(RangeError);
  });
});
