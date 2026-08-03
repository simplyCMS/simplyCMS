/**
 * Крок 2 пілота: розгортання скретч-магазину з fixture-шаблону.
 *
 * Шаблон (`tests/pilot/store-template/`) — це host ЧУЖОГО проєкту: ті самі
 * файли, що й у монорепо, але без жодного workspace-аліаса на `packages/**`.
 * Теми й плагіни копіюються з репо як власні файли магазину.
 *
 * Файли, побайтово ідентичні host-у (див. `HOST_FILES`), у шаблоні НЕ
 * зберігаються — вони копіюються звідси, з кореня репо, при кожному
 * розгортанні. Це виключає розсинхрон: правка host-файлу автоматично
 * потрапляє в наступний пілот без ручного дзеркалення.
 */

import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const TEMPLATE_DIR = join(REPO_ROOT, 'tests/pilot/store-template');

/**
 * Шляхи (відносно кореня репо), під якими шаблон магазину буквально
 * дублює host. Тримати їх у шаблоні окремим форком — гарантований дрейф
 * після першої ж правки host-файлу, тож копіюємо напряму з кореня.
 */
const HOST_FILES = [
  'server.mjs',
  'server-runtime.mjs',
  'src/styles/globals.css',
  'src/routes/__root.tsx',
  'src/start.ts',
  'src/client.tsx',
  'src/router.tsx',
  'src/server.ts',
  'src/server/engine.ts',
  'src/engine-provider.tsx',
  'src/theme-registry.ts',
];

/** Ключі, які магазин чекає у своєму `.env`. */
const ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SITE_URL',
];

/**
 * Розгорнути магазин: шаблон + теми/плагіни + tarball-и в manifest + `.env`.
 *
 * @param {{ storeDir: string; tarballs: Map<string,string>; env: Record<string,string> }} opts
 */
export function scaffoldStore({ storeDir, tarballs, env }) {
  rmSync(storeDir, { recursive: true, force: true });
  mkdirSync(storeDir, { recursive: true });

  cpSync(TEMPLATE_DIR, storeDir, { recursive: true });
  for (const relPath of HOST_FILES) {
    const dest = join(storeDir, relPath);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(REPO_ROOT, relPath), dest);
  }
  cpSync(join(REPO_ROOT, 'themes'), join(storeDir, 'themes'), {
    recursive: true,
    filter: (src) => !src.includes('node_modules'),
  });
  cpSync(
    join(REPO_ROOT, 'plugins/hello-world'),
    join(storeDir, 'plugins/hello-world'),
    { recursive: true, filter: (src) => !src.includes('node_modules') },
  );

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
