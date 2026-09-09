import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';

/**
 * simplycms.dev — статичний лендінг платформи.
 *
 * TanStack Start у режимі пререндеру: `vite build` рендерить сторінки в
 * статичний HTML (dist/client/), деплой — будь-який статичний хостинг.
 * Живі метрики (зірки GitHub, downloads npm) сторінка тягне КЛІЄНТСЬКИМ
 * fetch-ем при відкритті — тому контент не старіє між білдами.
 */
export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoSubfolderIndex: true,
      },
    }),
  ],
  // 3100 — щоб не зіткнутися з магазином монорепо на :3000
  server: { port: 3100, strictPort: true },
});
