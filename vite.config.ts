import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';
// Хост не має залежності `simplycms` — резолвить ядро alias-ом, якого
// конфіг Vite не бачить, тож декларація межі береться відносним шляхом.
import {
  serverOnlyFiles,
  serverOnlySpecifiers,
} from './packages/simplycms/src/contracts/server-only';

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
        // 🔴 Межа довіри клієнт/сервер у САМІЙ збірці магазину. Server-only
        // субшляхи ядра й серверні залежності не можуть потрапити в
        // клієнтський граф: Start валить збірку (dev і build) з трасою
        // імпорту. Список — єдина декларація ядра, не копія. `include: ['**']`
        // обовʼязковий: за замовчуванням перевіряються лише імпортери в `src/`,
        // а теми, плагіни й сам пакет ядра в node_modules лишилися б поза
        // перевіркою. Перевірка йде ПІСЛЯ компіляції serverFn, тож стаби з
        // серверними імпортами в тілах хендлерів її не тригерять.
        importProtection: {
          behavior: 'error',
          include: ['**'],
          client: {
            specifiers: serverOnlySpecifiers(),
            files: serverOnlyFiles(),
          },
        },
      }),
    ],
    resolve: {
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
      alias: {
        '@simplycms/plugin-faq': resolve(
          __dirname,
          'packages/simplycms-plugin-faq/src',
        ),
        '@simplycms/theme-solarstore': resolve(
          __dirname,
          'packages/simplycms-theme-solarstore/src',
        ),
        // Unscoped-флагман (К0): base-prefix, як і решта — @rollup/plugin-alias
        // матчить `simplycms` та `simplycms/<sub>`, але не `simplycms-*`.
        simplycms: resolve(__dirname, 'packages/simplycms/src'),
        '@themes': resolve(__dirname, 'themes'),
        '@plugins': resolve(__dirname, 'plugins'),
      },
    },
  };
};
