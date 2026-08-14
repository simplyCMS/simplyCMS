// Ядро `simplycms add <pkg> --theme --copy` (Фаза 4, Р5): пакет теми
// ставиться ТИМЧАСОВО, його `src/` копіюється в `themes/<key>/` магазину, і
// пакет знімається — далі тема живе локальною текою під аліасом `@themes/*`.
// Незворотні дії — лише після всіх валідацій; те, що вимагає вмісту пакета,
// робиться з відкатом `pnpm remove`.
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { hasPackage, insertEntry } from './config-edit.mjs';

/** Специфікатор copy-in-теми: npm-імʼя пакета в конфізі не зʼявляється ніколи. */
export const themeSpec = (key) => `@themes/${key}/index`;

/**
 * Перед-політ ДО будь-яких дій. `done` — тека вже є і конфіг на неї вказує
 * (повторний запуск = успіх, §3); тека є, а конфіг на неї не вказує — гучна
 * помилка: підмінити чужу теку мовчки не можна.
 * @param {{ storeRoot: string; key: string; source: string }} input
 * @returns {'done' | 'proceed'}
 */
export function copyPreflight({ storeRoot, key, source }) {
  if (!existsSync(join(storeRoot, 'themes', key))) return 'proceed';
  if (hasPackage(source, themeSpec(key))) return 'done';
  throw new Error(
    `Тека themes/${key} вже існує, але simplycms.config.ts на неї не вказує — ` +
      'прибери теку або задай інший ключ: --name <key>. Нічого не змінено.',
  );
}

/**
 * Форма пакета теми (конвенція Р3): код у `src/`, а `src` — у `files`, інакше
 * copy-in копіювати нічого. Провал валить установку з відкотом.
 * @param {string} pkgDir
 * @param {string} pkg
 */
export function assertCopyableTheme(pkgDir, pkg) {
  if (existsSync(join(pkgDir, 'src', 'index.ts'))) return;
  throw new Error(
    `Пакет ${pkg} не має src/index.ts — copy-in неможливий: тема мусить везти ` +
      'сирці (конвенція форми пакета теми). Встанови її як пакет: без --copy.',
  );
}

/**
 * Злиття залежностей теми в манифест магазину (ЧИСТА функція). Робиться ДО
 * `pnpm remove`: інакше remove забрав би замикання залежностей, і стороння
 * тема з власною бібліотекою просто не зібралася б.
 * @param {Record<string, unknown>} storeManifest
 * @param {Record<string, unknown>} themeManifest
 * @returns {{ manifest: Record<string, unknown>; added: string[] }}
 */
export function mergeDependencies(storeManifest, themeManifest) {
  const deps = { ...(storeManifest.dependencies ?? {}) };
  const known = new Set([
    ...Object.keys(deps),
    ...Object.keys(storeManifest.devDependencies ?? {}),
    ...Object.keys(storeManifest.peerDependencies ?? {}),
  ]);
  /** @type {string[]} */
  const added = [];
  for (const [name, range] of Object.entries(
    themeManifest.dependencies ?? {},
  )) {
    if (known.has(name)) continue;
    deps[name] = range;
    added.push(name);
  }
  return { manifest: { ...storeManifest, dependencies: deps }, added };
}

/**
 * Копія вмісту пакета в теку теми: `src/*` у корінь `themes/<key>/` плюс
 * README/LICENSE з кореня пакета, якщо вони їхали в tarball.
 * @param {{ pkgDir: string; targetDir: string }} input
 * @returns {string[]} що саме скопійовано (для звіту)
 */
export function copyThemeSources({ pkgDir, targetDir }) {
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(pkgDir, 'src'), targetDir, { recursive: true });
  const extras = ['README.md', 'LICENSE'].filter((name) =>
    existsSync(join(pkgDir, name)),
  );
  for (const name of extras) cpSync(join(pkgDir, name), join(targetDir, name));
  return ['src/*', ...extras];
}

/** Реальний виконавець pnpm; у тестах підмінюється власним. */
export const pnpmRunner = (storeRoot) => (args) =>
  execFileSync('pnpm', args, { cwd: storeRoot, stdio: 'inherit' });

/**
 * Сценарій copy-in у порядку Р5. Нічого не друкує — віддає звіт, тож ганяється
 * в тесті з фейковим `pnpm` без реальної установки.
 * @param {{ storeRoot: string; configPath: string; pkg: string; key: string;
 *   dryRun?: boolean; pnpm?: (args: string[]) => void }} input
 * @returns {{ status: 'done' | 'dry-run' | 'copied'; line?: string;
 *   copied?: string[]; added?: string[] }}
 */
export function runThemeCopy({
  storeRoot,
  configPath,
  pkg,
  key,
  dryRun = false,
  pnpm = pnpmRunner(storeRoot),
}) {
  const source = readFileSync(configPath, 'utf8');
  if (copyPreflight({ storeRoot, key, source }) === 'done')
    return { status: 'done' };

  // Вставка рахується ДО install: відсутній якір валить команду, поки на
  // диску не змінено нічого — ні конфіг, ні node_modules.
  const spec = themeSpec(key);
  const next = hasPackage(source, spec)
    ? null
    : insertEntry(source, { type: 'theme', key, pkg: spec });
  if (dryRun) return { status: 'dry-run', line: next?.line };

  pnpm(['add', pkg]);
  // Імʼя зі scope — це дві частини шляху в node_modules.
  const pkgDir = join(storeRoot, 'node_modules', ...pkg.split('/'));
  try {
    assertCopyableTheme(pkgDir, pkg);
  } catch (error) {
    pnpm(['remove', pkg]); // відкат: магазин лишається як був
    throw error;
  }

  const manifestPath = join(storeRoot, 'package.json');
  const { manifest, added } = mergeDependencies(
    JSON.parse(readFileSync(manifestPath, 'utf8')),
    JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')),
  );
  if (added.length > 0)
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const copied = copyThemeSources({
    pkgDir,
    targetDir: join(storeRoot, 'themes', key),
  });
  if (next) writeFileSync(configPath, next.source);
  pnpm(['remove', pkg]);
  return { status: 'copied', line: next?.line, copied, added };
}
