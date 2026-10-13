// Діапазон `engines.simplycms`, який референс-пакети й `simplycms create`
// записують у маніфест для даної версії ядра.
//
// Самодостатній (без імпорту з `./index`): `index` реекспортує цей файл, а
// цикл модулів у T0-пакеті зайвий. Копія для Node-ESM (CLI не залежить від
// ядра) — `packages/cli/src/core-range.mjs`, паритет стереже тест.

const CORE_VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Чесний semver: `M ≥ 1` → `^M.0.0` (злам = нова мажорна, тож 2.0 діапазон не
 * прийме); `0.m.p` → `^0.m.0` (caret на 0.x фіксує мінор, `^0.0.0` покрив би
 * лише 0.0.x). Невалідний рядок — виняток, не мовчазне `>=`.
 */
export function coreRangeFor(version: string): string {
  const match = CORE_VERSION_RE.exec(version.trim());
  if (!match) {
    throw new Error(`Невалідна версія ядра: "${version}" (очікується X.Y.Z)`);
  }
  const major = Number(match[1]);
  return major >= 1 ? `^${major}.0.0` : `^0.${Number(match[2])}.0`;
}
