import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { seoRoutesPlugin } from './src/seo/plugin';

export default {
  plugins: [tailwindcss(), tanstackStart(), seoRoutesPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      '@simplysoftua/db-types': resolve(__dirname, 'supabase/types.ts'),
      '@simplysoftua/objects': resolve(
        __dirname,
        'packages/simplycms/objects/src',
      ),
      '@simplysoftua/domain': resolve(
        __dirname,
        'packages/simplycms/domain/src',
      ),
      '@simplysoftua/data-supabase': resolve(
        __dirname,
        'packages/simplycms/data-supabase/src',
      ),
      '@simplysoftua/runtime': resolve(
        __dirname,
        'packages/simplycms/runtime/src',
      ),
      '@simplysoftua/react-query': resolve(
        __dirname,
        'packages/simplycms/react-query/src',
      ),
      '@simplysoftua/storefront': resolve(
        __dirname,
        'packages/simplycms/storefront/src',
      ),
      '@simplysoftua/cart-ui': resolve(
        __dirname,
        'packages/simplycms/cart-ui/src',
      ),
      '@simplysoftua/catalog-ui': resolve(
        __dirname,
        'packages/simplycms/catalog-ui/src',
      ),
      '@simplysoftua/checkout-ui': resolve(
        __dirname,
        'packages/simplycms/checkout-ui/src',
      ),
      '@simplysoftua/profile-ui': resolve(
        __dirname,
        'packages/simplycms/profile-ui/src',
      ),
      '@simplysoftua/reviews-ui': resolve(
        __dirname,
        'packages/simplycms/reviews-ui/src',
      ),
      '@simplysoftua/core': resolve(
        __dirname,
        'packages/simplycms/core/src',
      ),
      '@simplysoftua/admin': resolve(
        __dirname,
        'packages/simplycms/admin/src',
      ),
      '@simplysoftua/ui': resolve(
        __dirname,
        'packages/simplycms/ui/src',
      ),
      '@simplysoftua/plugins': resolve(
        __dirname,
        'packages/simplycms/plugin-system/src',
      ),
      '@simplysoftua/themes': resolve(
        __dirname,
        'packages/simplycms/theme-system/src',
      ),
      '@themes': resolve(__dirname, 'themes'),
      '@plugins': resolve(__dirname, 'plugins'),
    },
  },
};
