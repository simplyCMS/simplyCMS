// Основні мови, які можна обрати при створенні магазину. Дзеркало мовних пакетів ядра
// (`listLanguagePacks` з `simplycms/i18n/packs`): скаффолдер не залежить від ядра,
// тож список тримається вручну, а `tests/create-store-locales-parity.test.ts`
// червоніє, щойно пакет з'явився чи зник, а список — ні. Без пакета основну мову не
// стартувати (`applyMigrations` відмовить ще до з'єднання), тож «чужий» код тут шкодив би.

/** @type {readonly string[]} */
export const SUPPORTED_LOCALES = ['uk', 'en'];

/**
 * Код → відомий мовний пакет, інакше помилка з переліком (а не мовчазний запис у конфіг,
 * з яким перший накат відмовить уже на сервері).
 * @param {string} code
 * @returns {string}
 */
export function assertSupportedLocale(code) {
  if (!SUPPORTED_LOCALES.includes(code)) {
    throw new Error(
      `Невідома основна мова «${code}». Доступні: ${SUPPORTED_LOCALES.join(', ')}.`,
    );
  }
  return code;
}
