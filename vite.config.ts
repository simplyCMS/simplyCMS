import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';

export default ({ mode }: { mode: string }) => {
  // Контракт серверного env (спека CLI v1 §7): серверний код читає ЛИШЕ
  // `process.env` у рантаймі. Vite сам вантажить `.env`/`.env.local` тільки в
  // `import.meta.env` (клієнтський контур), тому для dev/build переносимо
  // файлові значення у `process.env` — ЛИШЕ відсутні ключі: реальний env
  // процесу завжди виграє (`loadEnv` і сам ставить `process.env` вище файлів,
  // а `.env.local` — вище `.env`). У prod те саме робить `server.mjs`.
  const fileEnv = loadEnv(mode, __dirname, '');
  for (const [key, value] of Object.entries(fileEnv)) {
    if (!(key in process.env)) process.env[key] = value;
  }

  return {
    plugins: [
      tailwindcss(),
      tanstackStart({
        router: { virtualRouteConfig: './routes.ts' },
        // Кастомний серверний вхід замість дефолтного: дає точку розширення
        // перед делегацією в Start-хендлер (див. `src/server.ts` — там же живуть
        // `/sitemap.xml` і `/robots.txt`, тому окремого SEO-плагіна немає).
        // 🔴 Шлях резолвиться ВІД `srcDirectory` (за замовчуванням `src/`), а не
        // від кореня — `'./src/server.ts'` тут мовчки не знайдеться і плагін
        // відкотиться на дефолтний entry (resolve-entries.js: `from: srcDirectory`).
        server: { entry: './server.ts' },
      }),
    ],
    resolve: {
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
      alias: {
        '@simplycms/objects': resolve(__dirname, 'packages/objects/src'),
        '@simplycms/domain': resolve(__dirname, 'packages/domain/src'),
        '@simplycms/data-supabase': resolve(
          __dirname,
          'packages/data-supabase/src',
        ),
        '@simplycms/supabase': resolve(__dirname, 'packages/supabase/src'),
        '@simplycms/storefront-routes': resolve(
          __dirname,
          'packages/storefront-routes/src',
        ),
        '@simplycms/i18n': resolve(__dirname, 'packages/i18n/src'),
        '@simplycms/runtime': resolve(__dirname, 'packages/runtime/src'),
        '@simplycms/react-query': resolve(
          __dirname,
          'packages/react-query/src',
        ),
        '@simplycms/storefront': resolve(__dirname, 'packages/storefront/src'),
        '@simplycms/cart-ui': resolve(__dirname, 'packages/cart-ui/src'),
        '@simplycms/catalog-ui': resolve(__dirname, 'packages/catalog-ui/src'),
        '@simplycms/checkout-ui': resolve(
          __dirname,
          'packages/checkout-ui/src',
        ),
        '@simplycms/profile-ui': resolve(__dirname, 'packages/profile-ui/src'),
        '@simplycms/reviews-ui': resolve(__dirname, 'packages/reviews-ui/src'),
        '@simplycms/core': resolve(__dirname, 'packages/core/src'),
        '@simplycms/admin': resolve(__dirname, 'packages/admin/src'),
        '@simplycms/ui': resolve(__dirname, 'packages/ui/src'),
        '@simplycms/plugins': resolve(__dirname, 'packages/plugin-system/src'),
        '@simplycms/themes': resolve(__dirname, 'packages/theme-system/src'),
        '@themes': resolve(__dirname, 'themes'),
        '@plugins': resolve(__dirname, 'plugins'),
      },
    },
  };
};
