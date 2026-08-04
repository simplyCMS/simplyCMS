import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

/**
 * Vite-конфіг магазину.
 *
 * 🔴 На відміну від монорепо SimplyCMS, у `resolve.alias` НЕМАЄ жодного запису
 * на `packages/**`. Усі `@simplycms/*` резолвляться штатним node-резолвом із
 * `node_modules`. Лишаються тільки `@themes`/`@plugins` — вони вказують на
 * локальні теки самого магазину (теми й плагіни — його власні файли).
 */
export default {
  plugins: [
    tailwindcss(),
    tanstackStart({
      router: { virtualRouteConfig: './routes.ts' },
      // Шлях резолвиться ВІД `srcDirectory` (`src/`), а не від кореня.
      server: { entry: './server.ts' },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      '@themes': resolve(__dirname, 'themes'),
      '@plugins': resolve(__dirname, 'plugins'),
    },
  },
  // 🔴 Порт dev-сервера прибитий до 3000 — того самого, що `pnpm start`
  // (`server.mjs`, PORT за замовчуванням 3000) і що `[auth] site_url` у
  // `supabase/config.toml`. Дефолт Vite — 5173, і тоді лист-запрошення
  // `owner:invite` (лінк будується з Site URL) вів би на порожній порт.
  // `strictPort` — щоб зайнятий 3000 падав явно, а не тихо переїжджав на 3001
  // і знову ламав лінк.
  server: { port: 3000, strictPort: true },
};
