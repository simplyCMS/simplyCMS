import { defineConfig } from 'simplycms/runtime';

/**
 * Конфіг магазину — єдине джерело істини для збірки.
 *
 * Звідси беруться локаль/валюта (`src/engine.shared.ts`), набір тем
 * (`src/theme-registry.ts`, `src/server.ts`) і набір плагінів
 * (`bootstrapPlugins` у `__root`). Назва магазину, заголовок головної й опис —
 * профіль магазину в адмінці (БД); URL сайту — env `VITE_SITE_URL`.
 *
 * Теми й плагіни лежать локально в самому магазині (аліаси `@themes`/`@plugins`
 * у `vite.config.ts`), ядро приходить із `node_modules`.
 */
export default defineConfig({
  locale: 'uk-UA',
  currency: 'UAH',
  plugins: [
    { name: 'hello-world', module: () => import('@plugins/hello-world') },
  ],
  themes: {
    default: () => import('@themes/default/index'),
  },
});
