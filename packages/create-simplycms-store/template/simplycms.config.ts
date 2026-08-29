import { defineConfig } from 'simplycms/runtime';

/**
 * Конфіг магазину — єдине джерело істини.
 *
 * Звідси беруться SEO/локаль/валюта (`src/engine.shared.ts`), набір тем
 * (`src/theme-registry.ts`) і набір плагінів (`bootstrapPlugins` у `__root`).
 *
 * Теми й плагіни лежать локально в самому магазині (аліаси `@themes`/`@plugins`
 * у `vite.config.ts`), ядро приходить із `node_modules`.
 */
export default defineConfig({
  seo: {
    siteName: 'SimplyCMS Store',
    defaultTitle: 'SimplyCMS Store — Best Products',
    titleTemplate: '%s | SimplyCMS Store',
    siteUrl: import.meta.env.VITE_SITE_URL ?? '',
    defaultDescription: 'SimplyCMS Store',
  },
  locale: 'uk-UA',
  currency: 'UAH',
  plugins: [
    { name: 'hello-world', module: () => import('@plugins/hello-world') },
  ],
  themes: {
    default: () => import('@themes/default/index'),
  },
});
