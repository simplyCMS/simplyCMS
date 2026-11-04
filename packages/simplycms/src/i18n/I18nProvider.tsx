import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator } from './translator';
import type { UiLocale } from 'simplycms/contracts';
import type { UiLocalePair } from './ui-locale';
import type { PartCatalog, Translator } from './types';

/** Значення контексту: транслятор + пара мов, що його породила. */
interface I18nContextValue extends UiLocalePair {
  t: Translator;
}

/**
 * Контекст мови інтерфейсу. Дефолт — `null`: відсутність провайдера це помилка збірки
 * магазину, а не привід тихо віддати українські рядки.
 */
const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Провайдер мови ІНТЕРФЕЙСУ. Ставиться в host-`__root.tsx` і обгортає ВСІ групи роутів.
 * Мову контенту він НЕ несе (спека §19.2): її читає `useContentLocale`, а сюди мова
 * приходить уже з моста `resolveUiLocale`.
 *
 * Провайдер — чистий контекст (Д3): каталоги вантажить роут (`useUiCatalogs`), тести
 * передають статичні. Тому вкладений провайдер (адмінка додає частину `admin`) просто
 * подає ширший набір, не знаючи про реєстр.
 *
 * Транслятор мемоїзується по каталогах і живе рівно стільки, скільки дерево рендера —
 * жодного глобального стану, тож SSR кількох запитів безпечний. Пара лежить у тому
 * самому значенні контексту (не окремі провайдери): `useThemeT`/`usePluginT`
 * потребують її для ланцюжка fallback каталогів теми й плагіна.
 *
 * `fallback` обов'язковий: без нього англомовному магазину дістались би або українські
 * рядки, або голі ключі.
 */
export function I18nProvider({
  locale,
  fallback,
  catalogs,
  children,
}: UiLocalePair & {
  catalogs: readonly PartCatalog[];
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ t: createTranslator(catalogs), locale, fallback }),
    [catalogs, locale, fallback],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18nContext(caller: string): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error(`${caller} використано поза <I18nProvider>`);
  }
  return ctx;
}

/** Транслятор поточного рендера. Кидає, якщо `I18nProvider` не змонтовано. */
export function useT(): Translator {
  return useI18nContext('useT()').t;
}

/**
 * Мова інтерфейсу поточного рендера — для форматування (дати, числа) і підписів.
 * НЕ мова контенту сторінки: та — `useContentLocale`. Кидає поза провайдером.
 */
export function useUiLocale(): UiLocale {
  return useI18nContext('useUiLocale()').locale;
}

/**
 * Пара мов інтерфейсу для хуків каталогів теми й плагіна (`useThemeT`, `usePluginT`):
 * вони самі не знають, яка мова основна. Кидає поза провайдером.
 */
export function useUiLocalePair(): UiLocalePair {
  const { locale, fallback } = useI18nContext('useUiLocalePair()');
  return useMemo(() => ({ locale, fallback }), [locale, fallback]);
}
