import { messages as uk } from './catalogs/uk/index';
import { messages as en } from './catalogs/en/index';
import type {
  Catalog,
  Locale,
  MessageKey,
  MessageParams,
  Translator,
} from './types';

/** Реєстр каталогів за локаллю. uk — повний, решта часткові. */
const catalogs: Record<Locale, Catalog> = { uk, en };

const SUPPORTED: readonly Locale[] = ['uk', 'en'];
const DEFAULT_LOCALE: Locale = 'uk';

/** `uk-UA` → `uk`, `EN` → `en`, невідома/порожня → `uk`. */
export function normalizeLocale(input: string): Locale {
  const base = input.split('-')[0]?.toLowerCase() ?? '';
  return SUPPORTED.find((locale) => locale === base) ?? DEFAULT_LOCALE;
}

/**
 * Підстановка `{name}` значеннями з `params`; невідомий плейсхолдер лишається як є.
 *
 * 🔴 Експортована навмисно: `useThemeT` (`simplycms/themes`) підставляє
 * параметри в каталог ТЕМИ за тією самою семантикою, і дублювати цю функцію
 * там означало б два джерела правди для одного форматування.
 */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Створює транслятор під конкретну локаль.
 *
 * Транслятор — замикання без модульного mutable-стану: жодного `setLocale`.
 * Тому SSR може тримати кілька трансляторів різних локалей одночасно
 * (per-request), і вони не впливають один на одного.
 */
export function createTranslator(locale: Locale): Translator {
  const catalog = catalogs[locale] ?? catalogs[DEFAULT_LOCALE];

  return (key: MessageKey, params?: MessageParams): string => {
    // Ланцюг: локаль → uk → сам ключ (видимий сигнал про пропущений переклад).
    const template = catalog[key] ?? uk[key] ?? key;
    return interpolate(template, params);
  };
}
