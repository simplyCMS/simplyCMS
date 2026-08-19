// Завантажувач модулів МАГАЗИНУ для `theme:conformance` (амендмент до Р8,
// 2026-08-18): резолв пакетів від кореня магазину, аліаси з його tsconfig і
// раннер vite, який уміє в TS/TSX. React, react-dom і vite у магазині вже є —
// донавантажується лише jsdom (див. theme-conformance-dom.mjs).
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Імпорт пакета З МАГАЗИНУ, а не з місця, де лежить сам CLI. Під pnpm
 * `@simplycms/cli` живе в ізольованому сторі, і звичайний `import('vite')`
 * звідти не резолвиться взагалі — резолв мусить іти від `package.json`
 * магазину.
 * @param {string} storeRoot
 * @param {string} spec
 */
export function importFromStore(storeRoot, spec) {
  const require = createRequire(join(storeRoot, 'package.json'));
  return import(pathToFileURL(require.resolve(spec)).href);
}

/**
 * Аліаси магазину з `compilerOptions.paths` його `tsconfig.json` — єдине
 * джерело, спільне для магазину (`@themes/*`, `@plugins/*`) і кореня монорепо
 * ядра (`@simplycms/*` на теки пакетів).
 *
 * 🔴 Конфіг vite тут НЕ читається, і це не спрощення: раннер vite примусово
 * ставить `configFile: false` (див. `runnerImport` у vite/dist/node), тож
 * аліаси однаково довелося б передати інлайном — а піднімати плагін
 * `tanstackStart` заради імпорту теми було б неспівмірно.
 * @param {string} storeRoot
 * @returns {{ find: string; replacement: string }[]}
 */
export function tsconfigAliases(storeRoot) {
  const path = join(storeRoot, 'tsconfig.json');
  if (!existsSync(path)) return [];
  let paths;
  try {
    paths = JSON.parse(readFileSync(path, 'utf8')).compilerOptions?.paths;
  } catch (cause) {
    throw new Error(
      `Не вдалося розібрати ${path} як JSON — theme:conformance бере звідти ` +
        'аліаси (@themes/*). Прибери коментарі або полагодь файл.',
      { cause },
    );
  }
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const [key, targets] of Object.entries(paths ?? {})) {
    const target = targets?.[0];
    if (typeof target !== 'string') continue;
    const find = key.endsWith('/*') ? key.slice(0, -2) : key;
    const to = target.endsWith('/*') ? target.slice(0, -2) : target;
    if (!map.has(find)) map.set(find, resolve(storeRoot, to));
  }
  // Довші префікси — першими: аліас vite підставляється префіксним збігом.
  return [...map]
    .sort(([a], [b]) => b.length - a.length)
    .map(([find, replacement]) => ({ find, replacement }));
}

/**
 * Раннер vite для модулів магазину. 🔴 Раннер саме ОДИН на прогін: і тему, і
 * kit треба взяти з ОДНОГО графа модулів — інакше в монорепо (де
 * `@simplycms/themes` резолвиться аліасом у сирці) kit реєстрував би тему в
 * СВОЄМУ `ThemeRegistry`, а `useThemeT` теми читав би чужий.
 * @param {string} storeRoot
 */
export async function createStoreRunner(storeRoot) {
  const { createRunnableDevEnvironment, resolveConfig } = await importFromStore(
    storeRoot,
    'vite',
  );
  const config = await resolveConfig(
    {
      root: storeRoot,
      configFile: false,
      envDir: false,
      logLevel: 'silent',
      cacheDir: join(storeRoot, 'node_modules/.vite-conformance'),
      resolve: {
        alias: tsconfigAliases(storeRoot),
        dedupe: ['react', 'react-dom'],
      },
      environments: {
        inline: {
          consumer: 'server',
          dev: { moduleRunnerTransform: true },
          resolve: { external: true, mainFields: [], conditions: ['node'] },
        },
      },
    },
    'serve',
  );
  const environment = createRunnableDevEnvironment('inline', config, {
    runnerOptions: { hmr: { logger: false } },
    hot: false,
  });
  await environment.init();
  return environment;
}
