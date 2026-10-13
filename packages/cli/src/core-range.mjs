// Вбудована копія `coreRangeFor` з `simplycms/contracts/semver` (core-range.ts):
// CLI не залежить від ядра, а діапазон `engines.simplycms` для `create` і
// бампу релізу має бути той самий. Паритет двох реалізацій стереже
// `tests/core-range-parity.test.ts` — правиш одну, правиш обидві.

const CORE_VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(-rc\.(?:0|[1-9]\d*))?$/;

/**
 * Чесний semver: `M ≥ 1` → `^M.0.0`; `0.m.p` → `^0.m.0` (caret на 0.x
 * фіксує мінор). Невалідний рядок — виняток.
 * @param {string} version
 * @returns {string}
 */
export function coreRangeFor(version) {
  const match = CORE_VERSION_RE.exec(String(version).trim());
  if (!match) {
    throw new Error(
      `Невалідна версія ядра: "${version}" (очікується X.Y.Z або X.Y.Z-rc.N)`,
    );
  }
  const major = Number(match[1]);
  // Пре-реліз (`-rc.N`): `^M.m.p-0` — npm-правило пре-релізів пускає RC лише у
  // діапазон із пре-релізною базою тієї ж трійки, тож база = трійка самого RC.
  if (match[4]) return `^${major}.${match[2]}.${match[3]}-0`;
  return major >= 1 ? `^${major}.0.0` : `^0.${Number(match[2])}.0`;
}
