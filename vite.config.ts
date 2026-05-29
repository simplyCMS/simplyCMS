import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { seoRoutesPlugin } from './src/seo/plugin';

export default {
  plugins: [tailwindcss(), tanstackStart(), seoRoutesPlugin()],
  resolve: {
    alias: {
      '@simplycms/db-types': resolve(__dirname, 'supabase/types.ts'),
      '@simplycms/objects': resolve(
        __dirname,
        'packages/simplycms/objects/src',
      ),
      '@simplycms/domain': resolve(
        __dirname,
        'packages/simplycms/domain/src',
      ),
      '@simplycms/data-supabase': resolve(
        __dirname,
        'packages/simplycms/data-supabase/src',
      ),
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
      '@simplycms/core': resolve(
        __dirname,
        'packages/simplycms/core/src',
      ),
      '@simplycms/admin': resolve(
        __dirname,
        'packages/simplycms/admin/src',
      ),
      '@simplycms/ui': resolve(
        __dirname,
        'packages/simplycms/ui/src',
      ),
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
