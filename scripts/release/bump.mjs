import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bumpManifestVersions } from './manifest-version.mjs';

const PACKAGES_DIR = 'packages';
/**
 * `X.Y.Z` або пре-реліз `X.Y.Z-rc.N` (N без провідних нулів — вимога semver до
 * числових ідентифікаторів). Інших пре-релізів лінія не має: ширший regex
 * прийняв би `1.0.0-beta` без правил порядку.
 */
export const VERSION_RE = /^\d+\.\d+\.\d+(-rc\.(0|[1-9]\d*))?$/;

/**
 * Порівняння semver: -1 / 0 / 1. Пре-реліз менший за реліз тієї ж трійки
 * (`1.0.0-rc.1 < 1.0.0`), номери RC порівнюються числово (`rc.10 > rc.9`).
 */
export function compareVersions(a, b) {
  const [coreA, preA] = a.split('-rc.');
  const [coreB, preB] = b.split('-rc.');
  const pa = coreA.split('.').map(Number);
  const pb = coreB.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  if (preA === undefined && preB === undefined) return 0;
  if (preA === undefined) return 1;
  if (preB === undefined) return -1;
  return Math.sign(Number(preA) - Number(preB));
}

/**
 * Гард релізу: нова версія мусить бути строго більшою за поточну (npm не дає
 * перезаписати опубліковану). Винесено з `release.mjs`, щоб порядок пре-релізів
 * мав один тестований шлях.
 * @param {string} next
 * @param {string} current
 */
export function assertNewerVersion(next, current) {
  if (compareVersions(next, current) <= 0) {
    throw new Error(
      `Версія ${next} не більша за поточну ${current}. ` +
        `npm не дає перезаписати опубліковану версію — підніми номер.`,
    );
  }
}

/**
 * Манифести публікованих пакетів (private — не наші).
 *
 * Після К0 тека `packages/` тримає рівно пʼять пакетів: unscoped флагман
 * `simplycms`, три сателіти `@simplycms/*` і unscoped `create-simplycms-store`;
 * усі вони публікуються тим самим реліз-потягом і мусять мати СИНХРОННУ
 * версію, тож дискримінатор тут — лише `private`. Точний набір (не поріг)
 * асертить `tests/release-bump-coverage.test.ts`.
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
 * Рантайм-константа версії ядра — оновлюється РАЗОМ із манифестами.
 *
 * `CORE_VERSION` живе в `simplycms/contracts` (перевірка `engines.simplycms`
 * тем/плагінів у клієнтському бандлі, де файлової системи немає); парність
 * із `package.json` стереже `packages/simplycms/src/contracts/__tests__/semver.test.ts`,
 * тож пропущений тут крок валить `pnpm test`, а не мовчки їде в реліз.
 */
const CORE_VERSION_FILE = join(
  PACKAGES_DIR,
  'simplycms',
  'src',
  'contracts',
  'semver',
  'version.ts',
);
const CORE_VERSION_RE =
  /export const CORE_VERSION = '(\d+\.\d+\.\d+(?:-rc\.(?:0|[1-9]\d*))?)';/;

function bumpCoreVersionConstant(version) {
  const source = readFileSync(CORE_VERSION_FILE, 'utf8');
  const match = CORE_VERSION_RE.exec(source);
  if (!match) {
    throw new Error(
      `Не знайдено CORE_VERSION у ${CORE_VERSION_FILE} — формат константи ` +
        `змінився, онови CORE_VERSION_RE у scripts/release/bump.mjs`,
    );
  }
  if (match[1] === version) return;
  writeFileSync(
    CORE_VERSION_FILE,
    source.replace(
      CORE_VERSION_RE,
      `export const CORE_VERSION = '${version}';`,
    ),
  );
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

  bumpCoreVersionConstant(version);
  // Version-літерали маніфестів референс-пакетів (плагіни/теми) — Р13 Фази 4.
  bumpManifestVersions(version);

  return { updated, skipped };
}
