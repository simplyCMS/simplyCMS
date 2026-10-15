import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ generations: new Map<string, bigint>() }));
vi.mock('../cache-generations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cache-generations')>()),
  readGenerations: vi.fn(async () => state.generations),
}));

import { CACHE_KEYS } from '../cache-generations';
import { createReadCache } from '../read-cache';

const KEY = CACHE_KEYS.languages;
const bump = () =>
  state.generations.set(
    KEY,
    (state.generations.get(KEY) ?? BigInt(0)) + BigInt(1),
  );

beforeEach(() => {
  state.generations = new Map([[KEY, BigInt(0)]]);
});

describe('createReadCache: варіант на мову (І36)', () => {
  it('uk і en — два виклики load, кожна мова кешується окремо', async () => {
    const cache = createReadCache<string>(KEY);
    const load = vi.fn(async () => 'v');
    await cache.get(load, { variant: 'en' });
    await cache.get(load, { variant: 'uk' });
    expect(load).toHaveBeenCalledTimes(2);
    await cache.get(load, { variant: 'en' });
    await cache.get(load, { variant: 'uk' });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('дві мови не діляться значенням', async () => {
    const cache = createReadCache<string>(KEY);
    expect(await cache.get(async () => 'en-текст', { variant: 'en' })).toBe(
      'en-текст',
    );
    expect(await cache.get(async () => 'uk-текст', { variant: 'uk' })).toBe(
      'uk-текст',
    );
    expect(await cache.get(async () => 'не кличеться', { variant: 'en' })).toBe(
      'en-текст',
    );
  });

  it('збільшення покоління скидає ОБИДВА варіанти', async () => {
    const cache = createReadCache<string>(KEY);
    const load = vi.fn(async () => 'v');
    await cache.get(load, { variant: 'en' });
    await cache.get(load, { variant: 'uk' });
    bump();
    await cache.get(load, { variant: 'en' });
    await cache.get(load, { variant: 'uk' });
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('виклик без варіанта живе окремо від варіантів і сумісний зі старим API', async () => {
    const cache = createReadCache<string>(KEY);
    const load = vi.fn(async () => 'v');
    await cache.get(load);
    await cache.get(load);
    await cache.get(load, { variant: 'en' });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
