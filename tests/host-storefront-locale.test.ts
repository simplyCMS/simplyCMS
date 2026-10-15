import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Проводка мовного контексту в host (`src/server.ts`): нормалізація
 * (301/404) стоїть ДО Start, а набір мов потрапляє в контекст запиту, звідки
 * його читає `getRouter()`. Ядро тестує окремі функції; лише цей тест доводить,
 * що обгортку справді підключено в ланцюг і вона стоїть усередині
 * `withRequestContext` (інакше писати набір мов було б нікуди).
 */
const seen = vi.hoisted(() => ({
  called: 0,
  storefront: undefined as unknown,
  loadSet: 0,
}));

vi.mock('@tanstack/react-start/server', () => ({
  defaultStreamHandler: () => new Response('stub'),
  createStartHandler: () => async () => {
    const { getRequestContext } =
      await import('simplycms/site/request-context');
    seen.called += 1;
    seen.storefront = getRequestContext()?.storefront;
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
vi.mock('simplycms/storefront/loaders', () => ({
  loadLocaleSet: async () => {
    seen.loadSet += 1;
    return {
      primary: 'uk',
      published: ['uk', 'en'],
      known: ['uk', 'en', 'pl'],
    };
  },
}));

beforeEach(() => {
  seen.called = 0;
  seen.storefront = undefined;
  seen.loadSet = 0;
});

async function fetchEntry(path: string, init?: RequestInit) {
  const entry = (await import('../src/server')).default as unknown as {
    fetch: (req: Request) => Promise<Response>;
  };
  return entry.fetch(new Request(`http://localhost${path}`, init));
}

describe('host src/server.ts: мовний контекст запиту', () => {
  it('/en/x → делегат викликано, набір мов у контексті запиту', async () => {
    const res = await fetchEntry('/en/x');
    expect(res.status).toBe(200);
    expect(seen.called).toBe(1);
    expect(seen.storefront).toEqual({
      locales: {
        primary: 'uk',
        published: ['uk', 'en'],
        known: ['uk', 'en', 'pl'],
      },
    });
  });

  it('/uk/x?a=1 → 301 /x?a=1 ДО Start', async () => {
    const res = await fetchEntry('/uk/x?a=1');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/x?a=1');
    expect(seen.called).toBe(0);
  });

  it('/en/x/ → рівно один 301 на /en/x', async () => {
    const res = await fetchEntry('/en/x/');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/en/x');
    expect(seen.called).toBe(0);
  });

  it('/pl/x (неопублікована) → 404 ДО Start', async () => {
    const res = await fetchEntry('/pl/x');
    expect(res.status).toBe(404);
    expect(seen.called).toBe(0);
  });

  it('заголовки безпеки лягають і на 301 (обгортка зовнішня)', async () => {
    const res = await fetchEntry('/uk/x');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('POST на /uk/x не редіректимо (301 перетворив би його на GET)', async () => {
    const res = await fetchEntry('/uk/x', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(seen.called).toBe(1);
  });

  it('POST на сторінку (CSRF) іде до Start БЕЗ читання мов: помилка БД не маскує 403', async () => {
    const res = await fetchEntry('/catalog', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });
    expect(res.status).toBe(200);
    expect(seen.called).toBe(1);
    expect(seen.loadSet).toBe(0);
  });

  it('/uk//evil.example → 301 на шлях того ж origin, не //evil.example', async () => {
    const res = await fetchEntry('/uk//evil.example');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/evil.example');
  });

  it('server functions, API, статика й медіа не ходять по мови', async () => {
    for (const path of [
      '/_serverFn/abc',
      '/api/v1/x',
      '/assets/a.js',
      '/media/a.png',
    ]) {
      const res = await fetchEntry(path);
      expect(res.status).toBe(200);
    }
    expect(seen.loadSet).toBe(0);
    expect(seen.storefront).toBeUndefined();
  });
});
