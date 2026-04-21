import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { resolve } from 'node:path';
import { seoRoutesPlugin } from './src/seo/plugin';

export default {
  plugins: [tanstackStart(), seoRoutesPlugin()],
  resolve: {
    alias: {
      '@simplycms/db-types': resolve(__dirname, 'supabase/types.ts'),
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
