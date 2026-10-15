import { getLanguagePack } from './packs';
import type { Locale, MessageKey, MessageParams, Translator } from './types';

// М2: зноситься разом із `config.locale` (мова магазину — з БД).
/**
 * Тимчасовий міст до М2 (знос `config.locale`): мовна частина тегу з конфіга
 * магазину в нижньому регістрі, `uk-UA` → `uk`, `EN` → `en`.
 *
 * НЕ загальна утиліта мов: для кодів мов магазину (`pt-BR` — окрема мова з
 * власним сегментом URL) регіон зрізати не можна. Мову не перевіряє й не
 * підміняє: невідома лишається собою (`fr-FR` → `fr`), а відсутність пакета
 * закриває фолбек транслятора.
 */
export function languageOfConfigLocale(tag: string): Locale {
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
