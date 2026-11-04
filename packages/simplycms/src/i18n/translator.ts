import { lookupMessage } from './lookup';
import type {
  MessageKey,
  MessageParams,
  PartCatalog,
  Translator,
} from './types';

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
