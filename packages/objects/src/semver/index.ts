// Мінімальний semver для перевірки `engines.simplycms` (спека §7).
//
// Свідомо НЕ npm-пакет `semver`: він CJS і важкий для клієнтського бандла,
// а T0-пакет тримає нуль залежностей. Підтримані форми діапазону — рівно ті,
// що потрібні контракту сумісності: точна версія, `^`, `~`, `>=`.
// Пре-релізи (`-beta.1`) не підтримуються — як і в реліз-потязі
// (`scripts/release/bump.mjs`, VERSION_RE).

export { CORE_VERSION } from './version';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

type Parsed = [number, number, number];

function parse(value: string, what: string): Parsed {
  const match = SEMVER_RE.exec(value.trim());
  if (!match) {
    throw new Error(
      `Невалідна ${what}: "${value}" (очікується X.Y.Z без пре-релізів)`,
    );
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(a: Parsed, b: Parsed): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/**
 * Чи задовольняє `version` діапазон `range`.
 *
 * Підтримані форми `range`: `1.2.3` (точна), `^1.2.3`, `~1.2.3`, `>=1.2.3`.
 * `^` — стандартна semver-семантика, включно з 0.x: `^0.1.0` НЕ покриває
 * `0.2.0` (перша ненульова компонента фіксується). Складені діапазони
 * (`>=0.1.0 <1.0.0`) не підтримуються.
 *
 * Невалідні вхідні дані — виняток (а не мовчазне `false`): хто перевіряє,
 * той і вирішує, чи це warn (bootstrap) чи фейл (CLI).
 */
export function satisfies(version: string, range: string): boolean {
  const v = parse(version, 'версія');
  const r = range.trim();

  if (r.startsWith('^')) {
    const base = parse(r.slice(1), 'база діапазону');
    if (compare(v, base) < 0) return false;
    if (base[0] > 0) return v[0] === base[0];
    if (base[1] > 0) return v[0] === 0 && v[1] === base[1];
    return v[0] === 0 && v[1] === 0 && v[2] === base[2];
  }
  if (r.startsWith('~')) {
    const base = parse(r.slice(1), 'база діапазону');
    return compare(v, base) >= 0 && v[0] === base[0] && v[1] === base[1];
  }
  if (r.startsWith('>=')) {
    return compare(v, parse(r.slice(2), 'база діапазону')) >= 0;
  }
  return compare(v, parse(r, 'база діапазону')) === 0;
}
