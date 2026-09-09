import { defineConfig } from 'simplycms/runtime';

/**
 * Конфіг магазину — єдине джерело істини.
 *
 * Звідси беруться SEO/локаль/валюта (`src/engine.shared.ts`), набір тем
 * (`src/theme-registry.ts`) і набір плагінів (`bootstrapPlugins` у `__root`).
 */
export default defineConfig({
  seo: {
    siteName: 'SimplyCMS Store',
    defaultTitle: 'SimplyCMS Store — Best Products',
    titleTemplate: '%s | SimplyCMS Store',
    siteUrl: import.meta.env.VITE_SITE_URL ?? '',
    defaultDescription: 'SimplyCMS Store',
  },
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
