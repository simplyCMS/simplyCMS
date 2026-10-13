// Порядок версій ядра для `simplycms update`: `X.Y.Z` і `X.Y.Z-rc.N`.
// Вбудована копія `compareVersions` з `scripts/release/bump.mjs` (CLI їде в
// npm окремо від скриптів репо); паритет стереже `tests/release-prerelease.test.ts`.

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(0|[1-9]\d*))?$/;

/**
 * @param {string} value
 * @returns {{ core: number[]; rc: number | null } | null} null — не `X.Y.Z[-rc.N]`
 */
export function parseVersion(value) {
  const match = VERSION_RE.exec(String(value).trim());
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    rc: match[4] === undefined ? null : Number(match[4]),
  };
}

/** Пре-реліз (`-rc.N`) — лише такий і знає лінія. */
export const isPrereleaseVersion = (value) => parseVersion(value)?.rc != null;

/**
 * Порівняння: -1 / 0 / 1. `1.0.0-rc.1 < 1.0.0-rc.2 < 1.0.0-rc.10 < 1.0.0`.
 * Невалідна версія — виняток (порівняння «наосліп» дало б тихий даунгрейд).
 * @param {string} a
 * @param {string} b
 */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) {
    throw new Error(`Невалідна версія для порівняння: "${pa ? b : a}"`);
  }
  for (let i = 0; i < 3; i += 1) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i] < pb.core[i] ? -1 : 1;
  }
  if (pa.rc === null && pb.rc === null) return 0;
  if (pa.rc === null) return 1;
  if (pb.rc === null) return -1;
  return Math.sign(pa.rc - pb.rc);
}

/** Мажорна складова версії. @param {string} value */
export function majorOf(value) {
  const parsed = parseVersion(value);
  if (!parsed) throw new Error(`Невалідна версія: "${value}"`);
  return parsed.core[0];
}
