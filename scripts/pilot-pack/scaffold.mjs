/**
 * Крок 2 пілота: розгортання скретч-магазину з шаблону `create-simplycms-store`.
 *
 * 🔴 Джерело правди розкладки магазину — `packages/create-simplycms-store/template`,
 * той самий шаблон, який отримує кінцевий користувач. Власної копії host-каркаса
 * пілот більше не тримає: що зламається в шаблоні — зламається і в пілоті, а не
 * сховається за форком фікстури.
 *
 * `tests/pilot/store-template/` лишається тонким ОВЕРЛЕЄМ — рівно ті два файли,
 * які в пілоті мусять відрізнятися від шаблону:
 *  - `vite.config.ts` — плюс плагін `emitBundleStats()`, без якого немає Gate C;
 *  - `package.json` — приватний manifest із плейсхолдером `overrides`, куди
 *    `writeManifest` підставляє шляхи tarball-ів.
 *
 * Теми (`themes/default`) і `plugins/hello-world` приходять із шаблону, а не з
 * кореня репо; їхню синхронність із монорепо стереже `pnpm template:sync` +
 * `tests/create-store-template-parity.test.ts`.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { TEMPLATE_DIR } from '../sync-create-store-template.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const PILOT_OVERLAY_DIR = join(REPO_ROOT, 'tests/pilot/store-template');

/**
 * Службові імена шаблону: ті самі перейменування, що робить CLI скаффолдера
 * (`packages/create-simplycms-store/src/scaffold.mjs`). Повторюємо їх тут, щоб
 * скретч був еквівалентом магазину, розгорнутого справжнім `pnpm create`.
 *
 * `package.json.tpl` до цієї мапи НЕ входить: у ньому плейсхолдери
 * (`__STORE_NAME__`, `__SIMPLYCMS_VERSION__`), невалідні для npm, а manifest
 * пілота приходить із оверлею — тож шаблонний просто видаляється.
 */
const RENAMES = { gitignore: '.gitignore', 'env.example': '.env.example' };

/** Ключі, які магазин чекає у своєму `.env`. */
const ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SITE_URL',
];

/**
 * Розгорнути магазин: шаблон пакета + пілотний оверлей + tarball-и та `.env`.
 *
 * @param {{ storeDir: string; tarballs: Map<string,string>; env: Record<string,string> }} opts
 */
export function scaffoldStore({ storeDir, tarballs, env }) {
  rmSync(storeDir, { recursive: true, force: true });
  mkdirSync(storeDir, { recursive: true });

  cpSync(join(REPO_ROOT, TEMPLATE_DIR), storeDir, {
    recursive: true,
    filter: (src) => !src.includes('node_modules'),
  });
  rmSync(join(storeDir, 'package.json.tpl'), { force: true });
  for (const [from, to] of Object.entries(RENAMES)) {
    if (existsSync(join(storeDir, from))) {
      renameSync(join(storeDir, from), join(storeDir, to));
    }
  }
  cpSync(PILOT_OVERLAY_DIR, storeDir, { recursive: true });

  writeManifest(storeDir, tarballs);
  writeEnv(storeDir, env);
}

/**
 * Підставити шляхи tarball-ів у manifest магазину.
 *
 * 🔴 Дві зафіксовані вади методу (обидві свідомі):
 *  1. npm НЕ резолвить `file:`-транзитивність по імені: якщо пакет A залежить
 *     від сиблінга B за версією `0.1.0`, npm піде за ним у registry, де його
 *     ще немає. Тому ВСІ пакети ядра прописуються в `overrides` — це єдиний
 *     спосіб змусити npm узяти локальний tarball на будь-якій глибині дерева.
 *  2. Через `overrides` пілот НЕ перевіряє повноту `dependencies` у manifest-ах
 *     (недекларована залежність усе одно встановиться). Статичну повноту
 *     гарантує окремий гейт — `node scripts/audit-deps.mjs` (Task 1.3).
 */
function writeManifest(storeDir, tarballs) {
  const manifestPath = join(storeDir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  for (const [name, tarball] of tarballs) {
    if (manifest.dependencies[name]) {
      manifest.dependencies[name] = `file:${tarball}`;
    }
  }

  manifest.overrides = Object.fromEntries(
    [...tarballs].map(([name, tarball]) => [name, `file:${tarball}`]),
  );

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/** `.env` магазину — vite підхоплює його з кореня проєкту на збірці. */
function writeEnv(storeDir, env) {
  const lines = ENV_KEYS.filter((key) => env[key]).map(
    (key) => `${key}=${env[key]}`,
  );
  writeFileSync(join(storeDir, '.env'), `${lines.join('\n')}\n`, 'utf8');
}
