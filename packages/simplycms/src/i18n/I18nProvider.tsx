import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator } from './translator';
import type { Locale, Translator } from './types';

/** Значення контексту: транслятор + локаль, що його породила. */
interface I18nContextValue {
  t: Translator;
  locale: Locale;
  /** Основна мова магазину: кінцева ланка fallback каталогів ядра, теми й плагінів. */
  fallback: Locale;
}

/**
 * Контекст локалі. Дефолт — `null`: відсутність провайдера це помилка збірки
 * магазину, а не привід тихо віддати українські рядки.
 */
const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Провайдер локалі. Ставиться в host-`__root.tsx` і обгортає ВСІ групи роутів.
 *
 * Транслятор мемоїзується по локалі й живе рівно стільки, скільки дерево
 * рендера — жодного глобального стану, тож SSR кількох запитів безпечний.
 * Локаль і fallback лежать у тому самому значенні контексту (не окремі
 * провайдери) — `useThemeT`/`usePluginT` потребують їх для ланцюжка fallback
 * каталогів теми й плагіна, а заводити другий контекст заради двох рядків зайве.
 *
 * `fallback` — основна мова магазину. Host передає її завжди; без пропа
 * fallback дорівнює самій локалі (каталог лише власної мови, далі ключ), а не
 * тихій `uk`: англомовному магазину українські рядки шкодять більше за ключ.
 */
export function I18nProvider({
  locale,
  fallback = locale,
  children,
}: {
  locale: Locale;
  fallback?: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ t: createTranslator(locale, fallback), locale, fallback }),
    [locale, fallback],
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
 * Активна локаль поточного рендера. Кидає, якщо `I18nProvider` не змонтовано —
 * так само, як `useT()`, і з тієї самої причини (SSR-запит без локалі — це
 * помилка збірки магазину).
 */
export function useLocale(): Locale {
  return useI18nContext('useLocale()').locale;
}

/**
 * Основна мова магазину поточного рендера — кінцева ланка fallback каталогів
 * теми й плагіна (їхні хуки не знають, яка мова основна). Кидає поза провайдером.
 */
export function useFallbackLocale(): Locale {
  return useI18nContext('useFallbackLocale()').fallback;
}
