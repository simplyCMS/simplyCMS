import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';
// #region pilot-only
import { writeFileSync } from 'node:fs';
// #endregion pilot-only
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
// #region pilot-only
/**
 * Міні-плагін bundle-stats для Gate C.
 *
 * 🔴 Решта файлу — БАЙТ-КОПІЯ `packages/create-simplycms-store/template/vite.config.ts`:
 * пілот мусить збирати скретч тим самим конфігом, який отримає користувач.
 * Стереже `tests/create-store-template-parity.test.ts` — він вирізає блоки
 * `#region pilot-only` і звіряє решту побайтово. Правки поза регіонами
 * робляться в шаблоні й переносяться сюди.
 *
 * Vite-manifest перелічує лише файли чанків, а гейту потрібен МОДУЛЬНИЙ граф:
 * які саме модулі потрапили в кожен чанк і які чанки статично імпортує entry.
 * Тому пишемо власний зріз із `generateBundle`.
 */
function emitBundleStats() {
  return {
    name: 'simplycms-pilot-bundle-stats',
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      const stats: Record<string, unknown> = {};
      for (const [fileName, chunk] of Object.entries(bundle)) {
        const c = chunk as Record<string, unknown>;
        if (c.type !== 'chunk') continue;
        stats[fileName] = {
          modules: Object.keys((c.modules ?? {}) as object),
          imports: (c.imports ?? []) as string[],
          dynamicImports: (c.dynamicImports ?? []) as string[],
          isEntry: Boolean(c.isEntry),
          name: c.name as string,
        };
      }
      // Ім'я середовища ('client' | 'ssr'/'server') — щоб гейт брав саме
      // клієнтський граф і не плутав його з серверним.
      const env =
        (this as { environment?: { name?: string } }).environment?.name ??
        'unknown';
      writeFileSync(
        resolve(__dirname, `bundle-stats.${env}.json`),
        JSON.stringify(stats, null, 2),
        'utf8',
      );
    },
  };
}

// #endregion pilot-only
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
      // #region pilot-only
      emitBundleStats(),
      // #endregion pilot-only
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
