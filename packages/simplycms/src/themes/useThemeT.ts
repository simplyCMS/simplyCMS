import { use, useMemo } from 'react';
import {
  createLookupTranslator,
  useUiLocalePair,
  type PluralTranslator,
} from 'simplycms/i18n';
import { useTheme } from './ThemeContext';
import { ThemeRegistry } from './ThemeRegistry';

/**
 * Транслятор каталогу ТЕМИ (не ядра).
 *
 * Ланцюжок — `lookupMessage` з `simplycms/i18n`, спільний із core-транслятором
 * і `usePluginT`: `messages[locale][key] → messages[основна][key] → сам key`.
 * Мови — мови ІНТЕРФЕЙСУ (пара з `I18nProvider`), не мова контенту сторінки.
 *
 * Транслятор — `PluralTranslator`: той самий контракт, що в ядра й плагіна, тож
 * `plural(t, key, n)` працює з ним без змін. Ключ-множина — значення `PluralForms`.
 *
 * Generic `K extends string` — це навмисно НЕ `MessageKey` ядра: кожна тема
 * оголошує СВІЙ union (`export type DefaultThemeKey = keyof typeof
 * messages.uk` у `themes/<тема>/messages.ts`) і передає його явно
 * (`useThemeT<DefaultThemeKey>()`), щоб отримати перевірку одруків у межах
 * ВЛАСНИХ ключів. theme-system про ключі конкретної теми нічого не знає.
 *
 * 🔴 Модуль теми береться з `ThemeRegistry.load(themeName)` через `use()`, а
 * НЕ з `activeTheme` контексту — і це не стильова дрібниця. `activeTheme`
 * стартує як `null` і наповнюється в `useEffect` (`ThemeContext.tsx`), а
 * ефекти на сервері не виконуються. Через контекст цей хук віддав би на SSR
 * СИРІ КЛЮЧІ (`theme.footer.brands`), а після гідрації — справжній текст:
 * класичний гідраційний мисматч, рівно того ж роду, що спіймав e2e на
 * форматуванні цін. `themeName` із контексту SSR-коректний (приходить
 * `initialThemeName` з лоадера), а `ThemeRegistry.load` віддає стабільну
 * проміс-референцію — той самий механізм, яким каркас
 * (`storefront-routes/src/shells/useActiveThemeModule.ts`) уже дістає
 * `components` теми на сервері.
 */
export function useThemeT<
  K extends string = string,
  P extends string = string,
>(): PluralTranslator<K, P> {
  const { locale, fallback } = useUiLocalePair();
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return useMemo(() => {
    const messages = theme.messages;
    // Кожна ланка несе свою мову: форми з каталогу fallback множаться за його правилами.
    return createLookupTranslator<K, P>(
      [
        { locale, catalog: messages?.[locale] },
        { locale: fallback, catalog: messages?.[fallback] },
      ],
      locale,
    );
  }, [theme, locale, fallback]);
}
