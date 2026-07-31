import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
// Шлях відносний, а не аліасний: vite.config.ts бандлиться esbuild-ом ДО того,
// як застосовується resolve.alias, тож пакетний спеціфаєр тут не резолвиться.
import { seoRoutesPlugin } from './packages/simplycms/storefront-routes/src/seo/plugin';

export default {
  plugins: [
    tailwindcss(),
    tanstackStart({ router: { virtualRouteConfig: './routes.ts' } }),
    seoRoutesPlugin({
      sitemapModule: '/packages/simplycms/storefront-routes/src/seo/sitemap.ts',
      robotsModule: '/packages/simplycms/storefront-routes/src/seo/robots.ts',
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      '@simplycms/db-types': resolve(__dirname, 'supabase/types.ts'),
      '@simplycms/objects': resolve(
        __dirname,
        'packages/simplycms/objects/src',
      ),
      '@simplycms/domain': resolve(__dirname, 'packages/simplycms/domain/src'),
      '@simplycms/data-supabase': resolve(
        __dirname,
        'packages/simplycms/data-supabase/src',
      ),
      '@simplycms/supabase': resolve(
        __dirname,
        'packages/simplycms/supabase/src',
      ),
      '@simplycms/storefront-routes': resolve(
        __dirname,
        'packages/simplycms/storefront-routes/src',
      ),
      '@simplycms/i18n': resolve(__dirname, 'packages/simplycms/i18n/src'),
      '@simplycms/runtime': resolve(
        __dirname,
        'packages/simplycms/runtime/src',
      ),
      '@simplycms/react-query': resolve(
        __dirname,
        'packages/simplycms/react-query/src',
      ),
      '@simplycms/storefront': resolve(
        __dirname,
        'packages/simplycms/storefront/src',
      ),
      '@simplycms/cart-ui': resolve(
        __dirname,
        'packages/simplycms/cart-ui/src',
      ),
      '@simplycms/catalog-ui': resolve(
        __dirname,
        'packages/simplycms/catalog-ui/src',
      ),
      '@simplycms/checkout-ui': resolve(
        __dirname,
        'packages/simplycms/checkout-ui/src',
      ),
      '@simplycms/profile-ui': resolve(
        __dirname,
        'packages/simplycms/profile-ui/src',
      ),
      '@simplycms/reviews-ui': resolve(
        __dirname,
        'packages/simplycms/reviews-ui/src',
      ),
      '@simplycms/core': resolve(__dirname, 'packages/simplycms/core/src'),
      '@simplycms/admin': resolve(__dirname, 'packages/simplycms/admin/src'),
      '@simplycms/ui': resolve(__dirname, 'packages/simplycms/ui/src'),
      '@simplycms/plugins': resolve(
        __dirname,
        'packages/simplycms/plugin-system/src',
      ),
      '@simplycms/themes': resolve(
        __dirname,
        'packages/simplycms/theme-system/src',
      ),
      '@themes': resolve(__dirname, 'themes'),
      '@plugins': resolve(__dirname, 'plugins'),
    },
  },
};
