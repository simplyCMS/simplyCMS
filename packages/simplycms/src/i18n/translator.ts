import { lookupMessage } from './lookup';
import { getLanguagePack } from './packs';
import type { UiLocale } from './ui-locale';
import type { MessageKey, MessageParams, Translator } from './types';

// М2: зноситься разом із `config.locale` (мова магазину — з БД).
/**
 * Тимчасовий міст до М2 (знос `config.locale`): мовна частина тегу з конфіга
 * магазину в нижньому регістрі, `uk-UA` → `uk`, `EN` → `en`.
 *
 * НЕ загальна утиліта мов: для кодів мов магазину (`pt-BR` — окрема мова з
 * власним сегментом URL) регіон зрізати не можна. Мову не перевіряє й не
 * підміняє: невідома лишається собою (`fr-FR` → `fr`), а відсутність пакета
 * закриває `toUiLocale` у викликача.
 */
export function languageOfConfigLocale(tag: string): string {
  return tag.split('-')[0]?.toLowerCase() ?? '';
}

/**
 * Створює транслятор під мову інтерфейсу.
 *
 * Ланцюг (`lookupMessage`): каталог мови → каталог `fallback` → сам ключ (видимий
 * сигнал про пропущений переклад). `fallback` обов'язковий і НЕ має дефолту: це основна
 * мова магазину, яка не обов'язково українська, а тихий `uk` віддав би англомовному
 * магазину українські рядки.
 *
 * Транслятор — замикання без модульного mutable-стану: жодного `setLocale`.
 * Тому SSR може тримати кілька трансляторів різних мов одночасно
 * (per-request), і вони не впливають один на одного.
 */
export function createTranslator(
  locale: UiLocale,
  fallback: UiLocale,
): Translator {
  const catalogs = [
    getLanguagePack(locale)?.catalog,
    getLanguagePack(fallback)?.catalog,
  ];
  return (key: MessageKey, params?: MessageParams): string =>
    lookupMessage(catalogs, key, params);
}
