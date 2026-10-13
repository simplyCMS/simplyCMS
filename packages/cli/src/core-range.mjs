// Вбудована копія `coreRangeFor` з `simplycms/contracts/semver` (core-range.ts):
// CLI не залежить від ядра, а діапазон `engines.simplycms` для `create` і
// бампу релізу має бути той самий. Паритет двох реалізацій стереже
// `tests/core-range-parity.test.ts` — правиш одну, правиш обидві.

const CORE_VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Чесний semver: `M ≥ 1` → `^M.0.0`; `0.m.p` → `^0.m.0` (caret на 0.x
 * фіксує мінор). Невалідний рядок — виняток.
 * @param {string} version
 * @returns {string}
 */
export function coreRangeFor(version) {
  const match = CORE_VERSION_RE.exec(String(version).trim());
  if (!match) {
    throw new Error(`Невалідна версія ядра: "${version}" (очікується X.Y.Z)`);
  }
  const major = Number(match[1]);
  return major >= 1 ? `^${major}.0.0` : `^0.${Number(match[2])}.0`;
}
