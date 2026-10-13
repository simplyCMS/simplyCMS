// Мінімальний semver для перевірки `engines.simplycms` (спека §7).
//
// Свідомо НЕ npm-пакет `semver`: він CJS і важкий для клієнтського бандла,
// а T0-пакет тримає нуль залежностей. Підтримані форми діапазону — рівно ті,
// що потрібні контракту сумісності: точна версія, `^`, `~`, `>=`.
// Пре-релізи — лише форма лінії релізів `X.Y.Z-rc.N` і нижня межа `X.Y.Z-0`
// (`scripts/release/bump.mjs`, VERSION_RE); `-beta.1` тощо — невалідні.

export { CORE_VERSION } from './version';
export { coreRangeFor } from './core-range';

// Четверта компонента — ранг пре-релізу: `-0` (нижня межа) < `-rc.N` < реліз.
// Реліз = Infinity, щоб звичайне порівняння компонент давало semver-порядок.
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-(0|rc\.(0|[1-9]\d*)))?$/;
const RELEASE = Number.POSITIVE_INFINITY;
const FLOOR = -1;

type Parsed = [number, number, number, number];

function parse(value: string, what: string): Parsed {
  const match = SEMVER_RE.exec(value.trim());
  if (!match) {
    throw new Error(
      `Невалідна ${what}: "${value}" (очікується X.Y.Z або X.Y.Z-rc.N)`,
    );
  }
  let rank = RELEASE;
  if (match[4] !== undefined)
    rank = match[5] === undefined ? FLOOR : Number(match[5]);
  return [Number(match[1]), Number(match[2]), Number(match[3]), rank];
}

function compare(a: Parsed, b: Parsed): number {
  for (let i = 0; i < 4; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

const sameTriple = (a: Parsed, b: Parsed): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

const isPrerelease = (p: Parsed): boolean => p[3] !== RELEASE;

/**
 * Чи задовольняє `version` діапазон `range`.
 *
 * Підтримані форми `range`: `1.2.3` (точна), `^1.2.3`, `~1.2.3`, `>=1.2.3`.
 * `^` — стандартна semver-семантика, включно з 0.x: `^0.1.0` НЕ покриває
 * `0.2.0` (перша ненульова компонента фіксується). Складені діапазони
 * (`>=0.1.0 <1.0.0`) не підтримуються.
 *
 * Пре-релізи — рівно як у npm-semver (`includePrerelease: false`): пре-реліз
 * проходить діапазон, лише якщо його трійка `[M,m,p]` збігається з трійкою
 * пре-релізної бази компаратора. `^1.0.0-0` приймає `1.0.0-rc.1`, `1.0.0` і
 * `1.7.0`, але не `1.1.0-rc.1` і не `2.0.0-rc.1`; `^1.0.0` пре-релізів не
 * приймає взагалі. Паритет з npm стереже `tests/semver-npm-parity.test.ts`.
 *
 * Невалідні вхідні дані — виняток (а не мовчазне `false`): хто перевіряє,
 * той і вирішує, чи це warn (bootstrap) чи фейл (CLI).
 */
export function satisfies(version: string, range: string): boolean {
  const v = parse(version, 'версія');
  const r = range.trim();

  if (r.startsWith('^') || r.startsWith('~') || r.startsWith('>=')) {
    const base = parse(r.slice(r.startsWith('>=') ? 2 : 1), 'база діапазону');
    // Правило npm-semver: пре-реліз проходить, лише якщо база компаратора —
    // пре-реліз ТІЄЇ САМОЇ трійки [M,m,p]; іншої трійки — ні.
    if (isPrerelease(v) && !(isPrerelease(base) && sameTriple(v, base)))
      return false;
    if (compare(v, base) < 0) return false;
    if (r.startsWith('>=')) return true;
    // Верхня межа ексклюзивна й сама пре-релізна (`-0`): тож `2.0.0-rc.1`
    // і `2.0.0` лишаються поза діапазоном `^1.x`.
    let upper: Parsed;
    if (r.startsWith('~')) upper = [base[0], base[1] + 1, 0, FLOOR];
    else if (base[0] > 0) upper = [base[0] + 1, 0, 0, FLOOR];
    else if (base[1] > 0) upper = [0, base[1] + 1, 0, FLOOR];
    else upper = [0, 0, base[2] + 1, FLOOR];
    return compare(v, upper) < 0;
  }
  return compare(v, parse(r, 'база діапазону')) === 0;
}
