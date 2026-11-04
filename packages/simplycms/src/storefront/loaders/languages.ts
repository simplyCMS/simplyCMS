import type { LocaleSet } from 'simplycms/contracts';
import { hasLanguagePack } from 'simplycms/i18n';
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

/** Мови, про які вже попередили в цьому процесі: один рядок логу на мову, не на запит. */
const warnedDegraded = new Set<string>();

/**
 * Гучний сигнал деградованого режиму (§19.15, Д12): опублікована мова без пакета (оновлення
 * платформи його прибрало). Вітрина цієї мови йде за інтерфейсом основної, тож власник
 * мусить побачити це в логу, а не вгадувати за змішаною вітриною. Не кидає: магазин має
 * стартувати й обслуговувати всі мови, а не лягти через оновлення.
 */
function warnDegradedLanguages(rows: readonly LanguageSummary[]): void {
  for (const { code, status } of rows) {
    if (status !== 'published' || warnedDegraded.has(code)) continue;
    if (hasLanguagePack(code)) continue;
    warnedDegraded.add(code);
    // Англійською: серверні логи платформи не локалізуються (як `[simplycms/mail]`), а кирилична
    // стрічка в зоні вітрини валить лінт i18n.
    console.warn(
      `[simplycms/i18n] Published language "${code}" has no language pack: its storefront ` +
        `UI falls back to the primary language (degraded mode). Restore the pack or disable ` +
        `the language; diagnostics: simplycms doctor --online.`,
    );
  }
}

/** Набір мов запиту (`primary`/`published`/`known`) з кешу мов. */
export async function loadLocaleSet(): Promise<LocaleSet> {
  const rows = await loadLanguages();
  warnDegradedLanguages(rows);
  return toLocaleSet(rows);
}
