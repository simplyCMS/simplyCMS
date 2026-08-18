/**
 * Гейт версії `inspection.json` (план Р2). Виокремлено з `map-tokens.mjs` за
 * тим самим правилом, що й `browser-fonts.mjs` із семплера: CLI-файл уперся в
 * канонні 150 рядків, а гейт — самостійна перевірка, яку хочеться мати під
 * юнітом БЕЗ `spawnSync` (процес доводить лише exit-код, не форму помилки).
 */

/**
 * Версії `inspection.json`, які тулчейн уміє читати: 1 — до motion-капчера,
 * 2 — із секцією `motion`. Мапінг обидві споживає однаково (motion у токени НЕ
 * йде), тож гейт застосовується до ПРОЧИТАНИХ файлів, а не всередині
 * `mapTokens`: при мультивході той отримує вже злитий обʼєкт, у якому поля
 * `schemaVersion` немає взагалі.
 */
export const SUPPORTED_INSPECTION_VERSIONS = [1, 2];

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
      `версія inspection.json (очікується ${SUPPORTED_INSPECTION_VERSIONS.join(' або ')}); ` +
      'перезніміть інспекцію актуальним inspect.mjs',
  );
}
