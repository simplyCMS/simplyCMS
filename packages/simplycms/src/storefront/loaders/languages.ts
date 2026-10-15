import type { LocaleSet } from 'simplycms/i18n';
import {
  languagesCache,
  readLanguages,
  toLocaleSet,
  type LanguageSummary,
} from 'simplycms/site';
import { withStorefrontDb } from './db';

/**
 * Мови магазину для вітрини крізь спільний кеш (покоління `languages` у БД, Д6):
 * мутація мов збільшує покоління у своїй транзакції, тож інші репліки бачать
 * нову мову на наступному запиті, не чекаючи TTL.
 */
export function loadLanguages(): Promise<LanguageSummary[]> {
  return languagesCache.get(() => withStorefrontDb((db) => readLanguages(db)));
}

/** Набір мов запиту (`primary`/`published`/`known`) з кешу мов. */
export async function loadLocaleSet(): Promise<LocaleSet> {
  return toLocaleSet(await loadLanguages());
}
