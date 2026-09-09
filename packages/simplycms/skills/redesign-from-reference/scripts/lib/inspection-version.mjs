/**
 * Гейт версії `inspection.json` (план Р2). Виокремлено з `map-tokens.mjs` за
 * тим самим правилом, що й `browser-fonts.mjs` із семплера: CLI-файл уперся в
 * канонні 150 рядків, а гейт — самостійна перевірка, яку хочеться мати під
 * юнітом БЕЗ `spawnSync` (процес доводить лише exit-код, не форму помилки).
 */

/**
 * Версії `inspection.json`, які тулчейн уміє читати: 1 — до motion-капчера,
 * 2 — із секцією `motion`, 3 — із чесним reveal-каналом (`revealSampled`/
 * `revealRoot`, `jsDrivenSuspected: boolean | 'unknown'`). Мапінг усі три
 * споживає однаково (motion у токени НЕ йде), тож сумісність зі старими
 * файлами лишається; гейт застосовується до ПРОЧИТАНИХ файлів, а не всередині
 * `mapTokens`: при мультивході той отримує вже злитий обʼєкт, у якому поля
 * `schemaVersion` немає взагалі.
 */
export const SUPPORTED_INSPECTION_VERSIONS = [1, 2, 3];

/** «1, 2 або 3» — перелік для тексту помилки, яку читає людина в терміналі. */
function listVersions(versions) {
  if (versions.length < 2) return String(versions[0] ?? '');
  return `${versions.slice(0, -1).join(', ')} або ${versions.at(-1)}`;
}

/**
 * Гучна відмова на незнайомій версії — краще, ніж тихо змапити чужу форму.
 * @param {string} path шлях до файлу (потрапляє в текст помилки)
 * @param {{ schemaVersion?: unknown }} [inspection] розібраний JSON
 * @throws {Error} якщо `schemaVersion` відсутній або не з підтримуваних
 */
export function assertSupportedVersion(path, inspection) {
  if (SUPPORTED_INSPECTION_VERSIONS.includes(inspection?.schemaVersion)) return;
  throw new Error(
    `${path}: schemaVersion=${inspection?.schemaVersion} — непідтримувана ` +
      `версія inspection.json (очікується ${listVersions(SUPPORTED_INSPECTION_VERSIONS)}); ` +
      'перезніміть інспекцію актуальним inspect.mjs',
  );
}
