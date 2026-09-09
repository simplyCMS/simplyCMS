import { describe, expect, it, vi } from 'vitest';
import { createSeoInterceptor, withSeoInterceptor } from '../interceptor';

const CACHE = 'public, max-age=3600, stale-while-revalidate=86400';

const builders = {
  sitemap: () => Promise.resolve('<urlset/>'),
  robots: () => Promise.resolve('User-agent: *'),
};

const req = (path: string) => new Request(`https://shop.test${path}`);

describe('createSeoInterceptor', () => {
  it('/sitemap.xml → 200, application/xml, public-cache', async () => {
    const response = await createSeoInterceptor(builders)(req('/sitemap.xml'));

    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toContain('application/xml');
    expect(response?.headers.get('cache-control')).toBe(CACHE);
    await expect(response?.text()).resolves.toBe('<urlset/>');
  });

  it('/robots.txt → 200, text/plain, public-cache', async () => {
    const response = await createSeoInterceptor(builders)(req('/robots.txt'));

    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toContain('text/plain');
    expect(response?.headers.get('cache-control')).toBe(CACHE);
    await expect(response?.text()).resolves.toBe('User-agent: *');
  });

  it('builder кинув → 500 БЕЗ public cache (щоб збій не осів на годину)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const interceptor = createSeoInterceptor({
      ...builders,
      sitemap: () => Promise.reject(new Error('RLS violation')),
    });

    const response = await interceptor(req('/sitemap.xml'));

    expect(response?.status).toBe(500);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(response?.headers.get('cache-control')).not.toContain('public');
    spy.mockRestore();
  });

  it('будь-який інший шлях → null', async () => {
    const interceptor = createSeoInterceptor(builders);

    await expect(interceptor(req('/'))).resolves.toBeNull();
    await expect(interceptor(req('/catalog'))).resolves.toBeNull();
    await expect(interceptor(req('/sitemap.xml/extra'))).resolves.toBeNull();
    // Query-рядок не має ховати SEO-шлях від інтерсептора.
    await expect(interceptor(req('/robots.txt?v=1'))).resolves.not.toBeNull();
  });
});

describe('withSeoInterceptor: делегація', () => {
  it('делегат кличеться рівно для не-SEO шляхів', async () => {
    const delegate = vi.fn(() => new Response('ssr'));
    const fetch = withSeoInterceptor(createSeoInterceptor(builders), delegate);

    await fetch(req('/sitemap.xml'));
    await fetch(req('/robots.txt'));
    expect(delegate).not.toHaveBeenCalled();

    const ssr = await fetch(req('/catalog'));
    expect(delegate).toHaveBeenCalledTimes(1);
    await expect(ssr.text()).resolves.toBe('ssr');
  });

  it('додаткові аргументи хендлера доходять до делегата', async () => {
    const delegate = vi.fn((_request: Request, _opts?: { flag: boolean }) =>
      Promise.resolve(new Response('ssr')),
    );
    const fetch = withSeoInterceptor(createSeoInterceptor(builders), delegate);

    await fetch(req('/catalog'), { flag: true });

    expect(delegate).toHaveBeenCalledWith(expect.any(Request), { flag: true });
  });
});
