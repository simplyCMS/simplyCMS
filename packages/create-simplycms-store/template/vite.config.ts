import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';

/**
 * Vite-конфіг магазину.
 *
 * 🔴 На відміну від монорепо SimplyCMS, у `resolve.alias` НЕМАЄ жодного запису
 * на `packages/**`. Усі `@simplycms/*` резолвляться штатним node-резолвом із
 * `node_modules`. Лишаються тільки `@themes`/`@plugins` — вони вказують на
 * локальні теки самого магазину (теми й плагіни — його власні файли).
 */
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
        // Шлях резолвиться ВІД `srcDirectory` (`src/`), а не від кореня.
        server: { entry: './server.ts' },
      }),
    ],
    resolve: {
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
      alias: {
        '@themes': resolve(__dirname, 'themes'),
        '@plugins': resolve(__dirname, 'plugins'),
      },
    },
    // 🔴 Порт dev-сервера прибитий до 3000 — того самого, що `pnpm start`
    // (`server.mjs`, PORT за замовчуванням 3000) і що `[auth] site_url` у
    // `supabase/config.toml`. Дефолт Vite — 5173, і тоді лист-запрошення
    // `owner:invite` (лінк будується з Site URL) вів би на порожній порт.
    // `strictPort` — щоб зайнятий 3000 падав явно, а не тихо переїжджав на 3001
    // і знову ламав лінк.
    server: { port: 3000, strictPort: true },
  };
};
