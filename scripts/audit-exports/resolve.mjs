/**
 * Резолв subpath-у проти ключів `package.json#exports` за алгоритмом Node
 * (exact match → pattern-match з одним `*`, найдовший префікс перемагає).
 */

/**
 * @param {string[]} exportsKeys
 * @param {string} subpath без провідного `./`
 * @returns {string | null} ключ, що збігся, або `null`
 */
/**
 * Файл, на який `subpath` реально вказує за ключем `key` і його ціллю з `exports`
 * (рядок): `*` ключа підставляється в ціль. `null` — ціль не рядок або без
 * розширення (її резолвить бандлер/TS: `./src/admin/pages/*`), тож існування не
 * перевіряється. Потрібне, бо ключ-патерн `./x/*` «покриває» будь-яке ім'я, а ціль
 * `./src/x/*.tsx` існує лише для `.tsx`-файлів: `.ts`-модуль під таким патерном у
 * монорепо резолвиться аліасом, а в tarball-і дає `ERR_MODULE_NOT_FOUND`.
 *
 * @param {string} key
 * @param {unknown} target
 * @param {string} subpath без провідного `./`
 * @returns {string | null} шлях відносно теки пакета
 */
export function exportTargetFile(key, target, subpath) {
  if (typeof target !== 'string') return null;
  const starIdx = key.indexOf('*');
  const prefix = starIdx === -1 ? key : key.slice(0, starIdx);
  const suffix = starIdx === -1 ? '' : key.slice(starIdx + 1);
  const want = `./${subpath}`;
  const matched =
    starIdx === -1
      ? ''
      : want.slice(prefix.length, want.length - suffix.length);
  const file = target.replace('*', matched);
  return /\.[a-z]+$/i.test(file) ? file : null;
}

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
