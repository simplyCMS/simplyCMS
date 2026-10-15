import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Д6: host (`src/server.ts`) обгортає fetch-handler у `withRequestContext`.
 * Ядро тестує `site/__tests__/request-context.test.ts`, парність лише звіряє
 * три копії файла між собою, а `live:smoke` не відрізнить "один запит
 * поколінь" від "по запиту на get" — тож підключення доводить тільки цей тест:
 * без обгортки контекст порожній, і кожен `get` кешу відкриває власну
 * транзакцію.
 */
const seen = vi.hoisted(() => ({
  context: undefined as unknown,
  queries: 0,
}));

vi.mock('@tanstack/react-start/server', () => ({
  defaultStreamHandler: () => new Response('stub'),
  // Справжній Start-хендлер підміняємо тим, що рахує контекст і запити.
  createStartHandler: () => async () => {
    const { getRequestContext } =
      await import('simplycms/site/request-context');
    const { readGenerations } = await import('simplycms/site');
    seen.context = getRequestContext();
    await readGenerations();
    await readGenerations();
    return new Response('ok');
  },
}));
vi.mock('@tanstack/react-start/server-entry', () => ({
  createServerEntry: (entry: unknown) => entry,
}));
vi.mock('simplycms/storefront-routes/seo/interceptor', () => ({
  createSeoInterceptor: () => async () => null,
  withSeoInterceptor: (_i: unknown, delegate: unknown) => delegate,
}));
vi.mock('simplycms/storefront-routes/seo/robots', () => ({
  buildRobotsTxt: vi.fn(),
}));
vi.mock('simplycms/storefront-routes/seo/sitemap', () => ({
  buildSitemapXml: vi.fn(),
}));
vi.mock('simplycms/env', () => ({ checkDriverEnvOnStart: vi.fn() }));
vi.mock('../simplycms.config', () => ({ default: { locale: 'uk-UA' } }));
vi.mock('simplycms/db', () => ({
  withActor: async (_actor: unknown, fn: (d: unknown) => Promise<unknown>) =>
    fn({
      select: () => ({
        from: async () => {
          seen.queries += 1;
          return [{ key: 'store-profile', generation: BigInt(1) }];
        },
      }),
    }),
}));

beforeEach(() => {
  seen.context = undefined;
  seen.queries = 0;
});

describe('host src/server.ts: контекст запиту (Д6)', () => {
  it('запит біжить у контексті, і покоління читаються рівно один раз', async () => {
    const entry = (await import('../src/server')).default as unknown as {
      fetch: (req: Request) => Promise<Response>;
    };
    const res = await entry.fetch(new Request('http://localhost/'));
    expect(res.status).toBe(200);
    expect(seen.context).not.toBeUndefined();
    expect(seen.queries).toBe(1);
  });
});
