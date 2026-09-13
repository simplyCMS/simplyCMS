import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';
// Хост не має залежності `simplycms` — резолвить ядро alias-ом, якого
// конфіг Vite не бачить, тож декларація межі береться відносним шляхом.
import { importProtection } from './packages/simplycms/src/contracts/server-only.ts';

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
        // Кастомний серверний вхід замість дефолтного: дає точку розширення
        // перед делегацією в Start-хендлер (див. `src/server.ts` — там же живуть
        // `/sitemap.xml` і `/robots.txt`, тому окремого SEO-плагіна немає).
        // 🔴 Шлях резолвиться ВІД `srcDirectory` (за замовчуванням `src/`), а не
        // від кореня — `'./src/server.ts'` тут мовчки не знайдеться і плагін
        // відкотиться на дефолтний entry (resolve-entries.js: `from: srcDirectory`).
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
        '@simplycms/plugin-faq': resolve(
          import.meta.dirname,
          'packages/simplycms-plugin-faq/src',
        ),
        '@simplycms/theme-solarstore': resolve(
          import.meta.dirname,
          'packages/simplycms-theme-solarstore/src',
        ),
        // Unscoped-флагман (К0): base-prefix, як і решта — @rollup/plugin-alias
        // матчить `simplycms` та `simplycms/<sub>`, але не `simplycms-*`.
        simplycms: resolve(import.meta.dirname, 'packages/simplycms/src'),
        '@themes': resolve(import.meta.dirname, 'themes'),
        '@plugins': resolve(import.meta.dirname, 'plugins'),
      },
    },
  };
};
