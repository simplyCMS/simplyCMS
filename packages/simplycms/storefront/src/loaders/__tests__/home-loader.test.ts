import { describe, it, expect } from 'vitest';
import type { StorefrontClient } from '../../client';
import { loadHomePageData } from '../home';

/**
 * Task 0.1: `loadHomePageData` не має ковтати помилку жодного з чотирьох
 * запитів `Promise.all` (banners/featured/newProducts/sections) — при
 * помилці будь-якого з них функція повинна кинути виняток.
 */

/** Thenable-білдер, що на будь-який виклик ланцюга повертає задане значення. */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.is = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.then = <TResult>(onfulfilled: (value: typeof result) => TResult) =>
    Promise.resolve(result).then(onfulfilled);
  return builder;
}

const OK = { data: [], error: null };
const FAIL = { data: null, error: { message: 'RLS violation' } };

function makeClient(overrides: Partial<Record<string, unknown>>) {
  const results: Record<string, { data: unknown; error: unknown }> = {
    banners: OK,
    products: OK,
    sections: OK,
    ...overrides,
  };
  return {
    from: (table: string) => makeBuilder(results[table]),
  } as unknown as StorefrontClient;
}

describe('loadHomePageData — помилки Supabase не ковтаються', () => {
  it('усі запити успішні → повертає дані', async () => {
    const client = makeClient({});
    await expect(loadHomePageData(client)).resolves.toEqual({
      banners: [],
      featuredProducts: [],
      newProducts: [],
      sections: [],
    });
  });

  it('помилка banners → reject', async () => {
    const client = makeClient({ banners: FAIL });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });

  it('помилка products (featured/new) → reject', async () => {
    const client = makeClient({ products: FAIL });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });

  it('помилка sections → reject', async () => {
    const client = makeClient({ sections: FAIL });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });
});
