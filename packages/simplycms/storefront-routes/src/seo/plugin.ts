import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Опції плагіна: шляхи до SEO-модулів, які підвантажує `ssrLoadModule`. */
export interface SeoRoutesPluginOptions {
  /**
   * Модуль з експортом `buildSitemapXml`.
   * Шлях від кореня проєкту, напр. `/packages/…/src/seo/sitemap.ts`.
   */
  sitemapModule: string;
  /**
   * Модуль з експортом `buildRobotsTxt`.
   * Шлях від кореня проєкту, напр. `/packages/…/src/seo/robots.ts`.
   */
  robotsModule: string;
}

/**
 * Vite plugin для обробки /sitemap.xml та /robots.txt.
 *
 * TanStack Start v1.167 не має createAPIFileRoute.
 * Цей plugin перехоплює запити і повертає XML/text відповіді.
 *
 * Працює в dev (configureServer) та preview (configurePreviewServer).
 * Для production build потрібен окремий server handler.
 *
 * Шляхи модулів — обовʼязкові опції без дефолту: плагін живе в пакеті, а
 * модулі резолвляться відносно кореня магазину-хоста. Дефолт на «старий»
 * шлях лише замаскував би помилку конфігурації мовчазним падінням у next().
 */
export function seoRoutesPlugin(options: SeoRoutesPluginOptions): Plugin {
  const { sitemapModule, robotsModule } = options;

  function createMiddleware(server: ViteDevServer) {
    return async (
      req: IncomingMessage,
      res: ServerResponse,
      next: () => void,
    ) => {
      if (req.url === '/sitemap.xml') {
        try {
          const { buildSitemapXml } = await server.ssrLoadModule(sitemapModule);
          const xml = await buildSitemapXml();
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.end(xml);
        } catch (err) {
          console.error('[sitemap] Помилка:', err);
          next();
        }
        return;
      }

      if (req.url === '/robots.txt') {
        try {
          const { buildRobotsTxt } = await server.ssrLoadModule(robotsModule);
          const text = await buildRobotsTxt();
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(text);
        } catch (err) {
          console.error('[robots] Помилка:', err);
          next();
        }
        return;
      }

      next();
    };
  }

  return {
    name: 'simplycms-seo-routes',
    configureServer(server) {
      server.middlewares.use(createMiddleware(server));
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        createMiddleware(server as unknown as ViteDevServer),
      );
    },
  };
}
