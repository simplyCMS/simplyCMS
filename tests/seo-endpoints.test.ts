import { describe, expect, it, vi } from 'vitest';
import { buildRobotsTxt, buildSitemapXml } from 'simplycms/storefront/seo';
import {
  createSeoInterceptor,
  withSeoInterceptor,
} from 'simplycms/storefront-routes/seo/interceptor';
import type { StorefrontClient } from 'simplycms/storefront';

// Крос-пакетний гейт (Task 2.2): справжні білдери `simplycms/storefront`
// у зв'язці з інтерсептором серверного входу з `simplycms/storefront-routes`.
// Транспорт SEO живе в server entry — один і той самий у dev, preview і
// production; тест перевіряє контракт цієї пари без підняття сервера.

const BASE_URL = 'https://shop.test';

interface MockResult {
  data: unknown;
  error: unknown;
}

/** Thenable-білдер Supabase з результатом за назвою таблиці. */
function makeClient(results: Record<string, MockResult>): StorefrontClient {
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.order = chain;
    builder.eq = chain;
    builder.then = <TResult>(onfulfilled: (value: MockResult) => TResult) =>
      Promise.resolve(results[table] ?? { data: [], error: null }).then(
        onfulfilled,
      );
    return builder;
  };
  return { from } as unknown as StorefrontClient;
}

const okClient = makeClient({
  sections: { data: [{ slug: 'shoes', updated_at: null }], error: null },
  products: {
    data: [{ slug: 'boot', updated_at: null, sections: { slug: 'shoes' } }],
    error: null,
  },
});

const failingClient = makeClient({
  sections: { data: null, error: { message: 'RLS violation' } },
  products: { data: [], error: null },
});

function makeFetch(
  client: StorefrontClient,
  delegate = vi.fn(() => new Response('ssr')),
) {
  const interceptor = createSeoInterceptor({
    sitemap: () => buildSitemapXml(client, BASE_URL),
    robots: () => buildRobotsTxt(BASE_URL),
  });
  return { fetch: withSeoInterceptor(interceptor, delegate), delegate };
}

const req = (path: string) => new Request(`${BASE_URL}${path}`);

describe('SEO-ендпойнти серверного входу', () => {
  it('/sitemap.xml → 200 XML з URL-ами каталогу + public cache', async () => {
    const { fetch, delegate } = makeFetch(okClient);

    const response = await fetch(req('/sitemap.xml'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, stale-while-revalidate=86400',
    );
    expect(body).toContain('<loc>https://shop.test/catalog/shoes/boot</loc>');
    expect(delegate).not.toHaveBeenCalled();
  });

  it('/robots.txt → 200 text/plain із посиланням на sitemap', async () => {
    const { fetch } = makeFetch(okClient);

    const response = await fetch(req('/robots.txt'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(body).toContain('Sitemap: https://shop.test/sitemap.xml');
    expect(body).toContain('Disallow: /admin/');
  });

  it('збій БД → 500 без public cache (кеш не фіксує неповний sitemap)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetch } = makeFetch(failingClient);

    const response = await fetch(req('/sitemap.xml'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    spy.mockRestore();
  });

  it('решта шляхів іде в SSR-хендлер', async () => {
    const { fetch, delegate } = makeFetch(okClient);

    await fetch(req('/'));
    await fetch(req('/catalog'));

    expect(delegate).toHaveBeenCalledTimes(2);
  });
});
