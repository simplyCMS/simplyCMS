import { defineConfig } from '@simplycms/runtime';

/**
 * Конфіг магазину — єдине джерело істини.
 *
 * Звідси беруться SEO/локаль/валюта (`src/engine.shared.ts`), набір тем
 * (`src/theme-registry.ts`) і набір плагінів (`bootstrapPlugins` у `__root`).
 */
export default defineConfig({
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL!,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
  },
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
    solarstore: () => import('@themes/solarstore/index'),
  },
});
