import { defineConfig } from '@simplycms/runtime';

/**
 * Конфіг скретч-магазину — копія host-конфіга без workspace-специфіки.
 *
 * Теми й плагіни лежать локально в самому магазині (`@themes`/`@plugins`
 * аліаси у `vite.config.ts`), ядро приходить із `node_modules`.
 */
export default defineConfig({
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL!,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
  },
  seo: {
    siteName: 'SimplyCMS Pilot Store',
    defaultTitle: 'SimplyCMS Pilot Store — Best Products',
    titleTemplate: '%s | SimplyCMS Pilot Store',
    siteUrl: import.meta.env.VITE_SITE_URL ?? '',
    defaultDescription: 'SimplyCMS Pilot Store',
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
