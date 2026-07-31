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
      '@simplysoftua/db-types': resolve(__dirname, 'supabase/types.ts'),
      '@simplysoftua/objects': pkg('objects/src'),
      '@simplysoftua/domain': pkg('domain/src'),
      '@simplysoftua/react-query': pkg('react-query/src'),
      '@simplysoftua/storefront': pkg('storefront/src'),
      '@simplysoftua/cart-ui': pkg('cart-ui/src'),
      '@simplysoftua/catalog-ui': pkg('catalog-ui/src'),
      '@simplysoftua/checkout-ui': pkg('checkout-ui/src'),
      '@simplysoftua/profile-ui': pkg('profile-ui/src'),
      '@simplysoftua/reviews-ui': pkg('reviews-ui/src'),
      '@simplysoftua/core': pkg('core/src'),
      '@simplysoftua/admin': pkg('admin/src'),
      '@simplysoftua/ui': pkg('ui/src'),
      '@simplysoftua/plugins': pkg('plugin-system/src'),
      '@simplysoftua/themes': pkg('theme-system/src'),
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
