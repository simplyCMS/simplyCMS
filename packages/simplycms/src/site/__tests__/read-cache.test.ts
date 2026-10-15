import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Покоління — єдине, що відрізняє цей кеш від TTL-кешу, тож керуємо ним
// напряму: «БД» тут — змінна `generations`.
const state = vi.hoisted(() => ({ generations: new Map<string, bigint>() }));
vi.mock('../cache-generations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cache-generations')>()),
  readGenerations: vi.fn(async () => state.generations),
}));

import { CACHE_KEYS } from '../cache-generations';
import { createReadCache } from '../read-cache';

const KEY = CACHE_KEYS.storeProfile;
const bump = (key: string = KEY) =>
  state.generations.set(
    key,
    (state.generations.get(key) ?? BigInt(0)) + BigInt(1),
  );

beforeEach(() => {
  vi.useFakeTimers();
  state.generations = new Map([[KEY, BigInt(0)]]);
});
afterEach(() => vi.useRealTimers());

describe('createReadCache (поколіннєвий)', () => {
  it('другий get без зміни покоління не кличе load', async () => {
    const cache = createReadCache<number>(KEY);
    const load = vi.fn(async () => 1);
    await cache.get(load);
    expect(await cache.get(load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('зміна покоління в БД змушує перечитати без очікування TTL', async () => {
    const cache = createReadCache<number>(KEY, { ttlMs: 60_000 });
    const load = vi.fn(async () => 1);
    await cache.get(load);
    bump();
    await cache.get(load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('покоління іншого ключа кеш не чіпає', async () => {
    const cache = createReadCache<number>(KEY);
    const load = vi.fn(async () => 1);
    await cache.get(load);
    bump(CACHE_KEYS.activeTheme);
    await cache.get(load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('після спливу TTL load кличеться знову, навіть без зміни покоління', async () => {
    const cache = createReadCache<number>(KEY, { ttlMs: 1000 });
    const load = vi.fn(async () => 1);
    await cache.get(load);
    vi.advanceTimersByTime(1001);
    await cache.get(load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('без TTL запис живе, доки покоління те саме', async () => {
    const cache = createReadCache<number>(KEY);
    const load = vi.fn(async () => 1);
    await cache.get(load);
    vi.advanceTimersByTime(24 * 3600 * 1000);
    await cache.get(load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('помилка load не кешується й пропускається далі', async () => {
    const cache = createReadCache<number>(KEY);
    await expect(
      cache.get(async () => {
        throw new Error('db down');
      }),
    ).rejects.toThrow('db down');
    const load = vi.fn(async () => 2);
    expect(await cache.get(load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  // Review Focus 3 (Е6б-9): читання стартувало до мутації, завершилось після.
  it('читання, що було в польоті під час зміни покоління, не лишає старе значення', async () => {
    const cache = createReadCache<string>(KEY, { ttlMs: 60_000 });
    let resolveOld!: (v: string) => void;
    const pending = cache.get(
      () => new Promise<string>((resolve) => (resolveOld = resolve)),
    );
    await vi.advanceTimersByTimeAsync(0);

    bump();
    resolveOld('старе');
    // Саме читання віддає те, що прочитало, — стара відповідь допустима
    // для запиту, який стартував раніше.
    expect(await pending).toBe('старе');

    // Але в кеші воно лежить під СТАРИМ поколінням: наступний get перечитує.
    const load2 = vi.fn(async () => 'нове');
    expect(await cache.get(load2)).toBe('нове');
    expect(load2).toHaveBeenCalledTimes(1);
  });

  it('повільне читання зі старішим поколінням не перезаписує свіжіший запис', async () => {
    const cache = createReadCache<string>(KEY);
    let resolveSlow!: (v: string) => void;
    const slow = cache.get(
      () => new Promise<string>((resolve) => (resolveSlow = resolve)),
    );
    await vi.advanceTimersByTimeAsync(0);

    bump();
    expect(await cache.get(async () => 'свіже')).toBe('свіже');
    resolveSlow('старе');
    await slow;

    const load = vi.fn(async () => 'зайве');
    expect(await cache.get(load)).toBe('свіже');
    expect(load).not.toHaveBeenCalled();
  });

  it('нульовий або відʼємний TTL відхиляється', () => {
    expect(() => createReadCache(KEY, { ttlMs: 0 })).toThrow(RangeError);
  });
});
