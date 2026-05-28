import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Vite plugin для обробки /sitemap.xml та /robots.txt.
 *
 * TanStack Start v1.167 не має createAPIFileRoute.
 * Цей plugin перехоплює запити і повертає XML/text відповіді.
 *
 * Працює в dev (configureServer) та preview (configurePreviewServer).
 * Для production build потрібен окремий server handler.
 */
export function seoRoutesPlugin(): Plugin {
  function createMiddleware(server: ViteDevServer) {
    return async (
      req: IncomingMessage,
      res: ServerResponse,
      next: () => void,
    ) => {
      if (req.url === '/sitemap.xml') {
        try {
          const { buildSitemapXml } = await server.ssrLoadModule(
            './src/seo/sitemap.ts',
          );
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
          const { buildRobotsTxt } = await server.ssrLoadModule(
            './src/seo/robots.ts',
          );
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
