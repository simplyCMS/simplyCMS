import { describe, expect, it, vi } from 'vitest';
import { buildRobotsTxt, renderSitemapXml } from 'simplycms/storefront/seo';
import type { SitemapData } from 'simplycms/storefront/loaders';
import {
  createSeoInterceptor,
  withSeoInterceptor,
} from 'simplycms/storefront-routes/seo/interceptor';

// Крос-пакетний гейт (Task 2.2): справжні білдери `simplycms/storefront`
// у зв'язці з інтерсептором серверного входу з `simplycms/storefront-routes`.
// Транспорт SEO живе в server entry — один і той самий у dev, preview і
// production; тест перевіряє контракт цієї пари без підняття сервера.
//
// 🔴 Мока Supabase тут більше немає (В2-К1а): рендер sitemap став чистою
// функцією від даних, а сам похід у базу — `withStorefrontDb` + Drizzle, і
// доводиться він на живому Postgres у `pnpm test:schema`. Для контракту
// «білдер упав → 500 без кешу» джерело падіння байдуже — важливо, що
// інтерсептор його не ковтає.

const BASE_URL = 'https://shop.test';

const DATA: SitemapData = {
  sections: [{ slug: 'shoes', updated_at: '2026-07-01T00:00:00Z' }],
  products: [
    { slug: 'boot', updated_at: '2026-07-01T00:00:00Z', section_slug: 'shoes' },
  ],
};

/** Білдер, що падає так само, як упав би збій транзакції вітрини. */
const failingSitemap = () =>
  Promise.reject(new Error('sitemap: транзакція вітрини впала'));

function makeFetch(
  sitemap: () => Promise<string>,
  delegate = vi.fn(() => new Response('ssr')),
) {
  const interceptor = createSeoInterceptor({
    sitemap,
    robots: () => buildRobotsTxt(BASE_URL),
  });
  return { fetch: withSeoInterceptor(interceptor, delegate), delegate };
}

const okSitemap = () => Promise.resolve(renderSitemapXml(DATA, BASE_URL));

const req = (path: string) => new Request(`${BASE_URL}${path}`);

describe('SEO-ендпойнти серверного входу', () => {
  it('/sitemap.xml → 200 XML з URL-ами каталогу + public cache', async () => {
    const { fetch, delegate } = makeFetch(okSitemap);

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
    const { fetch } = makeFetch(okSitemap);

    const response = await fetch(req('/robots.txt'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(body).toContain('Sitemap: https://shop.test/sitemap.xml');
    expect(body).toContain('Disallow: /admin/');
  });

  it('збій БД → 500 без public cache (кеш не фіксує неповний sitemap)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetch } = makeFetch(failingSitemap);

    const response = await fetch(req('/sitemap.xml'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    spy.mockRestore();
  });

  it('решта шляхів іде в SSR-хендлер', async () => {
    const { fetch, delegate } = makeFetch(okSitemap);

    await fetch(req('/'));
    await fetch(req('/catalog'));

    expect(delegate).toHaveBeenCalledTimes(2);
  });
});
