import { defineConfig } from '@simplysoftua/core/config';

export default defineConfig({
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL!,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
  },
  seo: {
    siteName: 'SimplyCMS Store',
    defaultTitle: 'SimplyCMS Store — Best Products',
    titleTemplate: '%s | SimplyCMS Store',
  },
  locale: 'uk-UA',
  currency: 'UAH',
});
