import type { ContentLocale } from 'simplycms/contracts';
import { LANGUAGE_PACKS } from './packs';
import type { LanguagePack } from './types';

/**
 * Брендований тип «мова ІНТЕРФЕЙСУ» — та, якою говорять кнопки, заголовки й листи
 * (каталоги ядра, теми, плагіна). Окремий бренд від `ContentLocale` (спека §19.2): це дві
 * осі, і мову контенту (`pl`) не можна подати замість мови інтерфейсу.
 *
 * 🔴 Значення створюють ЛИШЕ `resolveUiLocale` і `toUiLocale` цього файлу: код завжди має
 * наявний мовний пакет. Приведення `as UiLocale` деінде заборонене.
 */
export type UiLocale = string & { readonly __axis: 'ui' };

/** Пара мов інтерфейсу сторінки: власна і кінцева ланка fallback (пакет основної мови). */
export type UiLocalePair = {
  readonly locale: UiLocale;
  /** Основна мова магазину (її пакет): кінцева ланка fallback каталогів ядра, теми й плагіна. */
  readonly fallback: UiLocale;
};

/** Пакет за точним кодом, далі — за базовою мовою (`en-GB` → `en`). */
function packFor(code: string): LanguagePack | null {
  const exact = LANGUAGE_PACKS.get(code);
  if (exact) return exact;
  // Формат коду гарантує `checkedContentLocale`, тож `Intl.Locale` тут не кидає.
  return LANGUAGE_PACKS.get(new Intl.Locale(code).language) ?? null;
}

/** Чи знаходять кроки «точний код → базова мова» пакет для мови контенту (Р7). */
export function hasUiPack(code: ContentLocale): boolean {
  return packFor(code) !== null;
}

/**
 * Міст осі контенту до осі інтерфейсу (І42): мова сторінки без власного пакета не ламає
 * інтерфейс, а береться за основною мовою магазину. Порядок: пакет мови (точний → базова),
 * далі те саме для `primary`.
 *
 * Якщо пакета немає й для основної мови — кидає з переліком наявних пакетів: тиха
 * підміна `uk` показала б англомовному чи польському магазину чужий інтерфейс (Р7).
 */
export function resolveUiLocale(
  content: ContentLocale,
  primary: ContentLocale,
): UiLocale {
  const pack = packFor(content) ?? packFor(primary);
  if (!pack) {
    throw new Error(
      `simplycms/i18n: для мови «${content}» і основної «${primary}» немає мовного пакета ` +
        `інтерфейсу. Наявні пакети: ${[...LANGUAGE_PACKS.keys()].join(', ')}.`,
    );
  }
  return pack.code as UiLocale;
}

/**
 * Обидві мови інтерфейсу сторінки за мовою контенту й основною мовою магазину: те, що
 * несуть `I18nProvider`, дані кореня вітрини й транслятор екранів помилок.
 */
export function resolveUiLocalePair(
  content: ContentLocale,
  primary: ContentLocale,
): UiLocalePair {
  return {
    locale: resolveUiLocale(content, primary),
    fallback: resolveUiLocale(primary, primary),
  };
}

/**
 * Мова інтерфейсу зі збереженого значення (профіль, env): лише ТОЧНИЙ код наявного пакета,
 * без пошуку за базовою мовою — збережене значення мусить бути тим, що власник справді обрав.
 */
export function toUiLocale(value: string | null): UiLocale | null {
  return value !== null && LANGUAGE_PACKS.has(value)
    ? (value as UiLocale)
    : null;
}
