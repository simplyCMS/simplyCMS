import { lookupMessage } from './lookup';
import type {
  MessageKey,
  MessageParams,
  PartCatalog,
  Translator,
} from './types';

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
 * Створює транслятор над УЖЕ завантаженими частинами каталогу (завантаження — реєстр
 * `loadUiCatalog`, тут чиста синхронна функція).
 *
 * Ланцюг (`lookupMessage`): перший каталог, що має ключ → сам ключ (видимий сигнал про
 * пропущений переклад). Каталоги ядра повні для кожної мови (англійські частини
 * `satisfies Record<…Key, string>`), тож fallback-мови тут немає: вона потрібна лише
 * каталогам теми й плагіна, які можуть бути неповними (`useThemeT`).
 *
 * Транслятор — замикання без модульного mutable-стану: жодного `setLocale`. Тому SSR може
 * тримати кілька трансляторів різних мов одночасно (per-request).
 */
export function createTranslator(catalogs: readonly PartCatalog[]): Translator {
  return (key: MessageKey, params?: MessageParams): string =>
    lookupMessage(catalogs, key, params);
}
