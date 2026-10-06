import { defineConfig } from 'simplycms/runtime';

/**
 * Конфіг магазину — єдине джерело істини для збірки.
 *
 * Звідси беруться локаль/валюта (`src/engine.shared.ts`), набір тем
 * (`src/theme-registry.ts`, `src/server.ts`) і набір плагінів
 * (`bootstrapPlugins` у `__root`). Назва магазину, заголовок головної й опис —
 * профіль магазину в адмінці (БД); URL сайту — env `VITE_SITE_URL`.
 */
export default defineConfig({
  // 🔴 ЛИШЕ `import.meta.env` — цей файл імпортується виключно через Vite
  // (`src/engine.shared.ts`, `src/theme-registry.ts`), ніколи з Node; `process.env`
  // тут зламав би клієнтський бандл. `VITE_LOCALE` — локальний перемикач
  // збірки: дозволяє зібрати той самий магазин під іншою локаллю.
  locale: import.meta.env.VITE_LOCALE ?? 'uk-UA',
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
