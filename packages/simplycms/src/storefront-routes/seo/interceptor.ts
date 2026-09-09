/**
 * SEO-інтерсептор серверного входу: `/sitemap.xml` і `/robots.txt`.
 *
 * Транспорт — саме server entry (`createServerEntry`), а не vite-плагін:
 * дефолтний хендлер Start обробляє ВСІ запити одним fetch-ом, тож
 * `configureServer`/`configurePreviewServer` живуть лише в dev/preview і в
 * production мовчки зникають. Вхід же єдиний для трьох середовищ — dev
 * (`devServerPlugin` імпортує entry через runner), preview
 * (`previewServerPlugin` імпортує зібраний `dist/server/server.js`) і
 * production (`server.mjs`).
 */

/** Генератори SEO-документів (host-glue: клієнт даних + baseUrl — усередині). */
export interface SeoBuilders {
  /** `/sitemap.xml` */
  sitemap: () => Promise<string>;
  /** `/robots.txt` */
  robots: () => Promise<string>;
}

/** Перехоплювач: віддає `Response` для SEO-шляхів, інакше `null`. */
export type SeoInterceptor = (request: Request) => Promise<Response | null>;

/** Базовий хендлер, у який іде запит, якщо інтерсептор його не перехопив. */
export type SeoDelegate<TArgs extends unknown[]> = (
  request: Request,
  ...args: TArgs
) => Promise<Response> | Response;

/**
 * Кеш успішної відповіді: година свіжості + доба на stale-while-revalidate.
 * 🔴 Тільки для 200 — інакше збій БД осів би у CDN на годину.
 */
const SUCCESS_CACHE = 'public, max-age=3600, stale-while-revalidate=86400';

export function createSeoInterceptor(builders: SeoBuilders): SeoInterceptor {
  return async (request) => {
    const { pathname } = new URL(request.url);

    if (pathname === '/sitemap.xml') {
      return respond('sitemap', builders.sitemap, 'application/xml');
    }
    if (pathname === '/robots.txt') {
      return respond('robots', builders.robots, 'text/plain');
    }
    return null;
  };
}

/**
 * Обгортає базовий fetch-хендлер інтерсептором: SEO-шляхи не доходять до
 * роутера, решта делегується без змін (додаткові аргументи — прозоро).
 */
export function withSeoInterceptor<TArgs extends unknown[]>(
  interceptor: SeoInterceptor,
  delegate: SeoDelegate<TArgs>,
): (request: Request, ...args: TArgs) => Promise<Response> {
  return async (request, ...args) => {
    const intercepted = await interceptor(request);
    if (intercepted !== null) return intercepted;
    return delegate(request, ...args);
  };
}

/** Будує відповідь: 200 з public-кешем або 500 з `no-store`. */
async function respond(
  label: string,
  build: () => Promise<string>,
  contentType: string,
): Promise<Response> {
  try {
    return new Response(await build(), {
      status: 200,
      headers: {
        'content-type': `${contentType}; charset=utf-8`,
        'cache-control': SUCCESS_CACHE,
      },
    });
  } catch (error) {
    console.error(`[seo] ${label}: генерація впала`, error);
    return new Response(`${label} generation failed`, {
      status: 500,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }
}
