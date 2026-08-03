import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Vite-конфіг скретч-магазину.
 *
 * 🔴 Головна відмінність від монорепо: у `resolve.alias` НЕМАЄ жодного
 * запису на `packages/**`. Усі `@simplycms/*` резолвляться штатним
 * node-резолвом із `node_modules`, куди їх поклав `npm install` із
 * tarball-ів. Лишаються тільки `@themes`/`@plugins` — вони вказують на
 * локальні теки самого магазину (теми й плагіни — його власні файли).
 */

/**
 * Міні-плагін bundle-stats для Gate C.
 *
 * Vite-manifest перелічує лише файли чанків, а гейту потрібен МОДУЛЬНИЙ граф:
 * які саме модулі потрапили в кожен чанк і які чанки статично імпортує entry.
 * Тому пишемо власний зріз із `generateBundle`.
 */
function emitBundleStats() {
  return {
    name: 'simplycms-pilot-bundle-stats',
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      const stats: Record<string, unknown> = {};
      for (const [fileName, chunk] of Object.entries(bundle)) {
        const c = chunk as Record<string, unknown>;
        if (c.type !== 'chunk') continue;
        stats[fileName] = {
          modules: Object.keys((c.modules ?? {}) as object),
          imports: (c.imports ?? []) as string[],
          dynamicImports: (c.dynamicImports ?? []) as string[],
          isEntry: Boolean(c.isEntry),
          name: c.name as string,
        };
      }
      // Ім'я середовища ('client' | 'ssr'/'server') — щоб гейт брав саме
      // клієнтський граф і не плутав його з серверним.
      const env =
        (this as { environment?: { name?: string } }).environment?.name ??
        'unknown';
      writeFileSync(
        resolve(__dirname, `bundle-stats.${env}.json`),
        JSON.stringify(stats, null, 2),
        'utf8',
      );
    },
  };
}

export default {
  plugins: [
    tailwindcss(),
    tanstackStart({
      router: { virtualRouteConfig: './routes.ts' },
      // Шлях резолвиться ВІД `srcDirectory` (`src/`), а не від кореня.
      server: { entry: './server.ts' },
    }),
    emitBundleStats(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      '@themes': resolve(__dirname, 'themes'),
      '@plugins': resolve(__dirname, 'plugins'),
    },
  },
};
