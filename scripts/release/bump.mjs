import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = 'packages';
/** semver без пре-релізів: цього достатньо для синхронної моделі версій. */
export const VERSION_RE = /^\d+\.\d+\.\d+$/;

/** Порівняння semver: -1 / 0 / 1. */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/**
 * Манифести публікованих пакетів (private — не наші).
 *
 * Одна тека `packages/` тримає і 21 scoped-пакет ядра, і unscoped
 * `create-simplycms-store`; усі вони публікуються тим самим реліз-потягом
 * і мусять мати СИНХРОННУ версію, тож дискримінатор тут — лише `private`.
 */
export function readPublishableManifests() {
  const dirs = readdirSync(PACKAGES_DIR).map((dir) => join(PACKAGES_DIR, dir));
  const result = [];
  for (const dir of dirs) {
    const path = join(dir, 'package.json');
    if (!existsSync(path)) continue;
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    if (manifest.private === true) continue;
    result.push({ path, manifest });
  }
  return result;
}

/**
 * Поточна версія ядра.
 *
 * Модель синхронна, тож версія одна на всіх; якщо манифести розійшлися —
 * це помилка стану, і мовчки брати «якусь» не можна.
 */
export function currentVersion() {
  const versions = new Set(
    readPublishableManifests().map(({ manifest }) => manifest.version),
  );
  if (versions.size !== 1) {
    throw new Error(
      `Версії пакетів розійшлися: ${[...versions].join(', ')}. ` +
        `Модель синхронна — вирівняй їх (pnpm version:packages X.Y.Z) перед релізом.`,
    );
  }
  return [...versions][0];
}

/**
 * Проставити версію всім публікованим пакетам.
 *
 * @returns {{ updated: string[]; skipped: string[] }}
 */
export function bumpTo(version) {
  const updated = [];
  const skipped = [];

  for (const { path, manifest } of readPublishableManifests()) {
    if (manifest.version === version) {
      skipped.push(manifest.name);
      continue;
    }
    manifest.version = version;
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
    updated.push(manifest.name);
  }

  return { updated, skipped };
}
