/**
 * Резолв subpath-у проти ключів `package.json#exports` за алгоритмом Node
 * (exact match → pattern-match з одним `*`, найдовший префікс перемагає).
 */

/**
 * @param {string[]} exportsKeys
 * @param {string} subpath без провідного `./`
 * @returns {string | null} ключ, що збігся, або `null`
 */
export function resolveExportKey(exportsKeys, subpath) {
  const target = `./${subpath}`;
  if (exportsKeys.includes(target)) return target;

  /** @type {{ key: string; prefixLen: number }[]} */
  const candidates = [];
  for (const key of exportsKeys) {
    const starIdx = key.indexOf('*');
    if (starIdx === -1) continue;
    const prefix = key.slice(0, starIdx);
    const suffix = key.slice(starIdx + 1);
    if (
      target.startsWith(prefix) &&
      target.endsWith(suffix) &&
      target.length >= prefix.length + suffix.length
    ) {
      candidates.push({ key, prefixLen: prefix.length });
    }
  }
  candidates.sort((a, b) => b.prefixLen - a.prefixLen);
  return candidates[0]?.key ?? null;
}
