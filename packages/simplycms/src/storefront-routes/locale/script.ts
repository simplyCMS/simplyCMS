import type { LocaleSet } from 'simplycms/contracts';
import { checkedContentLocale } from 'simplycms/domain/translations';

/** Ключ у `window`, під яким лежить набір мов магазину для клієнтського `rewrite`. */
export const LOCALES_GLOBAL = '__SCMS_LOCALES__';

/**
 * Що сервер віддає клієнту: чернеток і вимкнених мов у HTML немає. Дротовий формат — прості
 * рядки: бренд `ContentLocale` повертає `readClientLocaleSet` через `checkedContentLocale`.
 */
export type PublicLocales = {
  readonly primary: string;
  readonly published: readonly string[];
};

/**
 * Тіло інлайн-скрипта для `<head>` (патерн `serializeActiveThemeScript`): клієнт
 * створює роутер ДО гідрації й має знати префікси, щоб `rewrite` розібрав
 * `/en/x` так само, як сервер. `<` екранується: код мови — дані з БД, і
 * `</script>` у ньому закрив би тег.
 */
export function serializeLocalesScript(locales: PublicLocales): string {
  const json = JSON.stringify({
    primary: locales.primary,
    published: locales.published,
  }).replace(/</g, '\\u003c');
  return `window[${JSON.stringify(LOCALES_GLOBAL)}]=${json}`;
}

/**
 * Набір мов із сервера (клієнт). Чернеток клієнт не бачить, тож `known` =
 * `published`: префікс неопублікованої мови до нього не доходить (сервер дає 404).
 */
export function readClientLocaleSet(): LocaleSet {
  const raw =
    typeof window === 'undefined'
      ? undefined
      : (window as unknown as Record<string, unknown>)[LOCALES_GLOBAL];
  if (!isPublicLocales(raw)) {
    throw new Error(
      `simplycms: window.${LOCALES_GLOBAL} is missing — the host root route ` +
        'must render serializeLocalesScript(languages) in <head>',
    );
  }
  return {
    primary: checkedContentLocale(raw.primary),
    published: raw.published.map(checkedContentLocale),
    known: raw.published.map(checkedContentLocale),
  };
}

function isPublicLocales(x: unknown): x is PublicLocales {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.primary === 'string' &&
    Array.isArray(r.published) &&
    r.published.every((c) => typeof c === 'string')
  );
}
