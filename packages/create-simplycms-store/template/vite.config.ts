import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';
import { importProtection } from 'simplycms/contracts/server-only';

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
  // `import.meta.dirname`, не `__dirname`: конфіг — ESM у пакеті з
  // `"type": "module"`; Vite попереджає про `__dirname` під майбутнім
  // дефолтом `configLoader: 'native'`, а прямий імпорт конфігу в тестах
  // падав саме на ньому (`ReferenceError: __dirname is not defined`).
  // Node ≥ 20.11 для цього є за побудовою: Start вимагає ≥ 22.12.
  const fileEnv = loadEnv(mode, import.meta.dirname, '');
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
        // 🔴 Межа довіри клієнт/сервер у САМІЙ збірці магазину: Start валить
        // збірку (dev і build) з трасою імпорту. Обʼєкт опції — з єдиної
        // декларації ядра (там же пояснено три пастки Start); тут — один
        // рядок, і гейт `tests/import-protection-wiring.test.ts` стереже,
        // що він саме такий і без `enabled:` поруч.
        importProtection: importProtection(),
      }),
    ],
    resolve: {
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
      alias: {
        '@themes': resolve(import.meta.dirname, 'themes'),
        '@plugins': resolve(import.meta.dirname, 'plugins'),
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
