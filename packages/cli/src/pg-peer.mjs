// Драйвер БД магазину (`pg`): спільна логіка doctor №13 і підказки `update`.
//
// 🔴 Чому магазин декларує `pg` сам: ядро лише ОЧІКУЄ драйвер (peer `pg`). Транзитивний `pg`
// під pnpm strict невидимий із кореня магазину, тож Vite вклеює його в серверний бандл, а
// дефект import-protection плагіна Start (`UPSTREAM:START-IP-1`) ламає вклеєний `pg-pool` на
// старті. Один екземпляр `pg` у магазині — ще й один пул та одна ідентичність типів.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const readJson = (path) =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;

/** @param {string} version */
const parse = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  return match ? match.slice(1, 4).map(Number) : null;
};

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Мінімальна перевірка semver-діапазону без залежностей (CLI їх не має): точна версія, `^`,
 * `~`, `>=`, альтернативи через `||`. Невідома форма → `null` (не вгадуємо).
 * @param {string} version
 * @param {string} range
 * @returns {boolean | null}
 */
export function satisfies(version, range) {
  const v = parse(version);
  if (!v) return null;
  let known = true;
  const hit = range.split('||').some((alt) => {
    const token = alt.trim();
    const m = /^(\^|~|>=)?\s*(\d+\.\d+\.\d+)$/.exec(token);
    const base = m && parse(m[2]);
    if (!m || !base) {
      known = false;
      return false;
    }
    if (compare(v, base) < 0) return false;
    if (m[1] === '>=') return true;
    if (m[1] === '~') return v[0] === base[0] && v[1] === base[1];
    if (m[1] === '^')
      return base[0] > 0
        ? v[0] === base[0]
        : v[0] === 0 && v[1] === base[1] && (base[1] > 0 || v[2] === base[2]);
    return compare(v, base) === 0;
  });
  return hit ? true : known ? false : null;
}

/**
 * Стан залежності-драйвера магазину: що декларовано, яка версія встановлена, який peer-діапазон
 * у ядра. Спільний для `pg` (№13) і `nodemailer` (№14).
 * @param {string} storeRoot
 * @param {Record<string, unknown>} manifest
 * @param {string} name
 */
export function readPeerState(storeRoot, manifest, name) {
  const deps = /** @type {Record<string,string>} */ (
    manifest.dependencies ?? {}
  );
  const installed = readJson(
    join(storeRoot, 'node_modules', name, 'package.json'),
  )?.version;
  const core = readJson(join(storeRoot, 'node_modules/simplycms/package.json'));
  return {
    declared: deps[name],
    installed: typeof installed === 'string' ? installed : undefined,
    peerRange: core?.peerDependencies?.[name],
  };
}

/**
 * Стан драйвера БД магазину (`pg`).
 * @param {string} storeRoot
 * @param {Record<string, unknown>} manifest
 */
export const readPgState = (storeRoot, manifest) =>
  readPeerState(storeRoot, manifest, 'pg');

/**
 * Підказка для `simplycms update`: чи треба вручну оновити `pg` магазину під peer нової версії
 * ядра. 🔴 `update` версію `pg` у `package.json` НЕ переписує (пін належить магазину, його
 * ставить власник): лише повідомляє. `null` — оновлювати нічого або порівняти нема з чим.
 * @param {string} storeRoot
 * @param {Record<string, unknown>} manifest
 * @returns {string | null}
 */
export function pgUpdateHint(storeRoot, manifest) {
  const { declared, installed, peerRange } = readPgState(storeRoot, manifest);
  if (!peerRange) return null;
  if (!declared)
    return `Магазин не оголошує pg: додай вручну — pnpm add pg@${peerRange}`;
  const version = installed ?? declared.replace(/^[\^~>=\s]+/, '');
  return satisfies(version, peerRange) === false
    ? `Ядро очікує pg «${peerRange}», у магазині ${version}. update версію pg не змінює — онови вручну: pnpm add pg@${peerRange}`
    : null;
}
