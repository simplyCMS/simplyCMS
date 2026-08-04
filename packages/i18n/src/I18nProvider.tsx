import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator } from './translator';
import type { Locale, Translator } from './types';

/**
 * Контекст локалі. Дефолт — `null`: відсутність провайдера це помилка збірки
 * магазину, а не привід тихо віддати українські рядки.
 */
const I18nContext = createContext<Translator | null>(null);

/**
 * Провайдер локалі. Ставиться в host-`__root.tsx` і обгортає ВСІ групи роутів.
 *
 * Транслятор мемоїзується по локалі й живе рівно стільки, скільки дерево
 * рендера — жодного глобального стану, тож SSR кількох запитів безпечний.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const t = useMemo(() => createTranslator(locale), [locale]);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

/** Транслятор поточного рендера. Кидає, якщо `I18nProvider` не змонтовано. */
export function useT(): Translator {
  const t = useContext(I18nContext);
  if (!t) {
    throw new Error('useT() використано поза <I18nProvider>');
  }
  return t;
}
