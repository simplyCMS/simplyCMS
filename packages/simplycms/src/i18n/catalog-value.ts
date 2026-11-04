import type { CatalogValue } from './types';

/** Категорії CLDR, дозволені як ключі форм. */
const CATEGORIES: ReadonlySet<string> = new Set([
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
]);

/**
 * Рантайм-перевірка значення каталогу теми чи плагіна (вони приходять із зовнішніх пакетів,
 * тип `CatalogValue` їх не гарантує): рядок або форми множини — об'єкт із рядковою `other`
 * і лише категоріями CLDR як ключами, кожна форма — рядок.
 *
 * Повноту категорій мови (рівно `Intl.PluralRules`) тут не перевіряють: це робить тест парності,
 * а рантайм `plural` у разі відсутньої категорії добирає `other`.
 */
export function isCatalogValue(value: unknown): value is CatalogValue {
  if (typeof value === 'string') return true;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return (
    typeof (value as { other?: unknown }).other === 'string' &&
    entries.every(
      ([category, text]) =>
        CATEGORIES.has(category) && typeof text === 'string',
    )
  );
}
