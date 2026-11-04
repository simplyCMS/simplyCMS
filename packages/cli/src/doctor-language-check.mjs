// Перевірка мов магазину для `doctor --online` (М2а Task 5б, спека §19.15, І46): опублікована
// мова без пакета працює деградовано (інтерфейс основною), і це помилка, а не попередження —
// власник мусить побачити її не лише в логу сервера. Перелік пакетів CLI не тримає: бере з
// ядра магазину (`simplycms/i18n#hasLanguagePack`), тим самим пошуком, що й публікація мови.
import { check, reason } from './online-state-checks.mjs';
import { importFromStore } from './store-core.mjs';

const TITLE = 'Мови магазину (мовні пакети)';

/**
 * @param {string} storeRoot
 * @param {string[]} publishedLanguages коди опублікованих мов з БД
 * @param {{ hasLanguagePack: (code: string) => boolean }} [i18n] ін'єкція для тестів
 * @returns {Promise<import('./ui.mjs').Check>}
 */
export async function languagePackCheck(storeRoot, publishedLanguages, i18n) {
  let core = i18n;
  try {
    core ??= await importFromStore(storeRoot, 'simplycms/i18n');
  } catch (error) {
    // warn, не skip: збій імпорту не мусить ховати сигнал про мови (І46) — власник має знати,
    // що перевірку пакетів не виконано.
    return check(
      'language-packs',
      TITLE,
      'warn',
      `не вдалося імпортувати simplycms/i18n з магазину — перевірку пакетів мов не виконано: ${reason(error)}`,
    );
  }
  const missing = publishedLanguages.filter(
    (code) => !core.hasLanguagePack(code),
  );
  if (missing.length === 0) return check('language-packs', TITLE, 'ok');
  return check(
    'language-packs',
    TITLE,
    'error',
    `опублікована мова без мовного пакета: ${missing.join(', ')} — вітрина цієї мови ` +
      `показує інтерфейс основною (деградований режим); поверни пакет оновленням платформи ` +
      `(CHANGELOG, BREAKING) або вимкни мову в адмінці`,
  );
}
