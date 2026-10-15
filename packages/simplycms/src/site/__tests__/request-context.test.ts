import { beforeEach, describe, expect, it, vi } from 'vitest';

// Фейковий `db` рахує запити поколінь: саме вони — предмет контракту Д6.
const db = vi.hoisted(() => ({ queries: 0 }));
vi.mock('simplycms/db', () => ({
  withActor: async (_actor: unknown, fn: (d: unknown) => Promise<unknown>) =>
    fn({
      select: () => ({
        from: async () => {
          db.queries += 1;
          return [
            { key: 'store-profile', generation: BigInt(1) },
            { key: 'active-theme', generation: BigInt(1) },
            { key: 'languages', generation: BigInt(1) },
          ];
        },
      }),
    }),
}));

import { CACHE_KEYS, readGenerations } from '../cache-generations';
import { createReadCache } from '../read-cache';
import { getRequestContext, withRequestContext } from '../request-context';

const caches = () =>
  Object.values(CACHE_KEYS).map((key) => createReadCache<string>(key));

beforeEach(() => {
  db.queries = 0;
});

describe('withRequestContext і покоління', () => {
  it('три кеші в одному запиті → рівно ОДИН запит поколінь', async () => {
    const handler = withRequestContext(async () => {
      await Promise.all(caches().map((c) => c.get(async () => 'v')));
      // Другий прохід того ж запиту теж не ходить у БД за поколіннями.
      await Promise.all(caches().map((c) => c.get(async () => 'v')));
      return new Response('ok');
    });
    await handler(new Request('http://localhost/'));
    expect(db.queries).toBe(1);
  });

  it('кожен запит має власний контекст і власний запит поколінь', async () => {
    const handler = withRequestContext(async () => {
      await readGenerations();
      return new Response('ok');
    });
    await handler(new Request('http://localhost/'));
    await handler(new Request('http://localhost/'));
    expect(db.queries).toBe(2);
  });

  it('поза контекстом — запит поколінь на кожен get', async () => {
    expect(getRequestContext()).toBeUndefined();
    for (const cache of caches()) await cache.get(async () => 'v');
    expect(db.queries).toBe(3);
  });

  it('контекст запиту порожній на старті й видимий у вкладених викликах', async () => {
    let seen: unknown;
    await withRequestContext(async () => {
      await Promise.resolve();
      seen = getRequestContext();
      return new Response('ok');
    })(new Request('http://localhost/'));
    expect(seen).toEqual({});
  });
});
