#!/usr/bin/env node

/**
 * Пакування пакетів ядра у tarball-и та їх інспекція (Task 1.4).
 *
 * Джерело правди про опублікований пакет — НЕ `package.json` у репозиторії, а
 * те, що реально лягло в `.tgz`: `pnpm pack` застосовує `publishConfig`
 * (піднімає dist-`exports`/`main`/`types` у корінь manifest-а), підставляє
 * версії замість `workspace:*` і відсікає все, чого немає в `files`. Саме цей
 * артефакт і перевіряє parity-suite.
 *
 * Потребує попереднього `pnpm build:packages` — `pnpm pack` збірку не запускає.
 *
 * Використання:
 *   import { packPublishable } from './pack-inspect.mjs'
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readTarball } from './pack-inspect/tar.mjs';

const PACKAGES_ROOT = resolve(import.meta.dirname, '../packages');

/**
 * Теки пакетів ядра, позначених як публічні (`private: false`).
 *
 * 🔴 Дві умови, і обидві потрібні. `private === false` — явна позначка
 * публічності. Друга умова — імʼя ядра: префікс `@simplycms/` АБО точне
 * `simplycms` (unscoped-флагман К0). Вона відсікає unscoped
 * `create-simplycms-store`, що лежить у тій самій теці: у нього немає
 * `publishConfig.exports`, тож parity-suite не має що в ньому звіряти, а
 * пілот не має чого з нього ставити. Покладатись тут на те, що в його
 * манифесті просто немає ключа `private`, не можна — це збіг, а не контракт.
 */
const CORE_SCOPE = '@simplycms/';
const CORE_FLAGSHIP = 'simplycms';

/** Чи це пакет ядра (scoped-сателіт або unscoped-флагман). */
const isCorePackage = (name) =>
  typeof name === 'string' &&
  (name.startsWith(CORE_SCOPE) || name === CORE_FLAGSHIP);

export function publishableDirs() {
  return readdirSync(PACKAGES_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((dir) => {
      try {
        const json = JSON.parse(
          readFileSync(join(PACKAGES_ROOT, dir, 'package.json'), 'utf8'),
        );
        return json.private === false && isCorePackage(json.name);
      } catch {
        return false;
      }
    })
    .sort();
}

/**
 * Спакувати всі публічні пакети у тимчасову теку й розібрати їхні tarball-и.
 *
 * @returns {Map<string, {
 *   dir: string;
 *   source: Record<string, unknown>;
 *   manifest: Record<string, unknown>;
 *   files: string[];
 * }>} ключ — імʼя пакета
 */
export function packPublishable() {
  const dest = mkdtempSync(join(tmpdir(), 'simplycms-pack-'));
  const result = new Map();

  for (const dir of publishableDirs()) {
    const cwd = join(PACKAGES_ROOT, dir);
    const source = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));

    execFileSync('pnpm', ['pack', '--pack-destination', dest], {
      cwd,
      stdio: 'pipe',
    });

    const tgz = join(
      dest,
      `${source.name.replace('@', '').replace('/', '-')}-${source.version}.tgz`,
    );
    const entries = readTarball(tgz);
    const manifest = JSON.parse(
      entries.get('package/package.json')?.toString('utf8') ?? '{}',
    );

    result.set(source.name, {
      dir,
      source,
      manifest,
      // Шляхи всередині пакета, без префікса `package/`.
      files: [...entries.keys()]
        .filter((p) => p.startsWith('package/'))
        .map((p) => p.slice('package/'.length)),
    });
  }

  return result;
}

/**
 * Чи існує в tarball-і файл під ціль export-а. Патерн з `*` вважається
 * виконаним, якщо збігся хоча б один файл.
 *
 * @param {string[]} files
 * @param {string} target
 */
export function targetExists(files, target) {
  const rel = target.replace(/^\.\//, '');
  if (!rel.includes('*')) return files.includes(rel);

  const rx = new RegExp(
    `^${rel
      .split('*')
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.+')}$`,
  );
  return files.some((f) => rx.test(f));
}

/** Усі рядки-цілі з блоку `exports` (умови розгортаються). */
export function exportTargets(exportsField) {
  const out = [];
  const walk = (node) => {
    if (typeof node === 'string') out.push(node);
    else if (node && typeof node === 'object')
      Object.values(node).forEach(walk);
  };
  walk(exportsField ?? {});
  return out;
}
