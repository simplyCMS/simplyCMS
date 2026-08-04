/**
 * Крок 1 пілота: збірка пакетів ядра і пакування їх у tarball-и.
 *
 * 🔴 Саме `pnpm pack`, а не `npm pack`: pnpm застосовує `publishConfig`
 * (піднімає dist-`exports`/`main`/`types` у корінь manifest-а) і підставляє
 * реальні версії замість `workspace:*`. `npm pack` цього не робить — магазин
 * отримав би непридатний tarball із `workspace:*` у dependencies.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { publishableDirs } from '../pack-inspect.mjs';
import { readFileSync } from 'node:fs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const PACKAGES_ROOT = join(REPO_ROOT, 'packages');

/** `pnpm build:packages` — `pnpm pack` збірку НЕ запускає, dist має бути готовим. */
export function buildPackages() {
  execFileSync('pnpm', ['build:packages'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
}

/**
 * Спакувати всі публічні пакети ядра у `destDir`.
 *
 * @param {string} destDir тека для `.tgz`
 * @returns {Map<string, string>} імʼя пакета → абсолютний шлях до tarball-а
 */
export function packAll(destDir) {
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  /** @type {Map<string, string>} */
  const tarballs = new Map();

  for (const dir of publishableDirs()) {
    const cwd = join(PACKAGES_ROOT, dir);
    const { name, version } = JSON.parse(
      readFileSync(join(cwd, 'package.json'), 'utf8'),
    );

    execFileSync('pnpm', ['pack', '--pack-destination', destDir], {
      cwd,
      stdio: 'pipe',
    });

    // Імʼя файлу детерміноване: `@scope/name` → `scope-name-version.tgz`.
    const file = `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;
    tarballs.set(name, join(destDir, file));
  }

  return tarballs;
}
