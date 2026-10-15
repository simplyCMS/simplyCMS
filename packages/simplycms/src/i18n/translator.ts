import { getLanguagePack } from './packs';
import type { Locale, MessageKey, MessageParams, Translator } from './types';

/**
 * `uk-UA` → `uk`, `EN` → `en`: мовна частина тегу в нижньому регістрі.
 *
 * Міст до `config.locale`, що несе регіон (`uk-UA`). Мову не перевіряє й не
 * підміняє: невідома лишається собою (`fr-FR` → `fr`), а відсутність пакета
 * закриває фолбек транслятора.
 * М2: зноситься разом із `config.locale` (мова магазину — з БД).
 */
export function languageOf(tag: string): Locale {
  return tag.split('-')[0]?.toLowerCase() ?? '';
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
 * Ланцюг: каталог мови → каталог `fallback` → сам ключ (видимий сигнал про
 * пропущений переклад). `fallback` обов'язковий і НЕ має дефолту: це основна
 * мова магазину, яка не обов'язково українська, а тихий `uk` віддав б
 * англомовному магазину українські рядки.
 *
 * Транслятор — замикання без модульного mutable-стану: жодного `setLocale`.
 * Тому SSR може тримати кілька трансляторів різних локалей одночасно
 * (per-request), і вони не впливають один на одного.
 */
export function createTranslator(locale: Locale, fallback: Locale): Translator {
  const own = getLanguagePack(locale)?.catalog;
  const base = getLanguagePack(fallback)?.catalog;

  return (key: MessageKey, params?: MessageParams): string => {
    const template = own?.[key] ?? base?.[key] ?? key;
    return interpolate(template, params);
  };
}
