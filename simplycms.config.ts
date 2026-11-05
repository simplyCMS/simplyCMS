import { defineConfig } from 'simplycms/runtime';

/**
 * Конфіг магазину — єдине джерело істини для збірки.
 *
 * Звідси беруться валюта (`src/engine.shared.ts`), набір тем
 * (`src/theme-registry.ts`, `src/server.ts`) і набір плагінів
 * (`bootstrapPlugins` у `__root`). Назва магазину, заголовок головної й опис —
 * профіль магазину в адмінці (БД); URL сайту — env `VITE_SITE_URL`.
 */
export default defineConfig({
  currency: 'UAH',
  plugins: [
    { name: 'hello-world', module: () => import('@plugins/hello-world') },
    { name: 'faq', module: () => import('@simplycms/plugin-faq') },
  ],
  themes: {
    default: () => import('@themes/default/index'),
    solarstore: () => import('@simplycms/theme-solarstore'),
  },
});
