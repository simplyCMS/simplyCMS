import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const pkg = (p: string) => resolve(__dirname, 'packages/simplycms', p);

// Окремий конфіг для тестів: @vitejs/plugin-react (а не tanstackStart, що
// SSR-трансформує і ламає hook-тести) + дедуп React + ті самі workspace-аліаси,
// що й у vite.config.ts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      '@simplycms/db-types': resolve(__dirname, 'supabase/types.ts'),
      '@simplycms/objects': pkg('objects/src'),
      '@simplycms/domain': pkg('domain/src'),
      '@simplycms/react-query': pkg('react-query/src'),
      '@simplycms/storefront': pkg('storefront/src'),
      '@simplycms/cart-ui': pkg('cart-ui/src'),
      '@simplycms/catalog-ui': pkg('catalog-ui/src'),
      '@simplycms/checkout-ui': pkg('checkout-ui/src'),
      '@simplycms/profile-ui': pkg('profile-ui/src'),
      '@simplycms/reviews-ui': pkg('reviews-ui/src'),
      '@simplycms/core': pkg('core/src'),
      '@simplycms/admin': pkg('admin/src'),
      '@simplycms/ui': pkg('ui/src'),
      '@simplycms/plugins': pkg('plugin-system/src'),
      '@simplycms/themes': pkg('theme-system/src'),
      '@themes': resolve(__dirname, 'themes'),
      '@plugins': resolve(__dirname, 'plugins'),
    },
  },
  test: {
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.output/**',
      '**/package/**', // витяги npm/pnpm pack
    ],
  },
});
