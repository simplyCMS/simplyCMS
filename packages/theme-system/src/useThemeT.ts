import { use, useCallback } from 'react';
import { interpolate, useLocale, type MessageParams } from '@simplycms/i18n';
import { useTheme } from './ThemeContext';
import { ThemeRegistry } from './ThemeRegistry';

/**
 * Транслятор каталогу ТЕМИ (не ядра).
 *
 * Ланцюжок fallback — `messages[locale][key] → messages['uk'][key] → сам key`
 * (видимий сигнал про пропущений переклад, як і в core-транслятора
 * `createTranslator`). Підстановка `{param}` — та сама функція `interpolate`
 * з `@simplycms/i18n`: дублювати її тут означало б два джерела правди для
 * одного форматування.
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
export function useThemeT<K extends string = string>(): (
  key: K,
  params?: MessageParams,
) => string {
  const locale = useLocale();
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return useCallback(
    (key: K, params?: MessageParams): string => {
      const messages = theme.messages;
      const template = messages?.[locale]?.[key] ?? messages?.uk?.[key] ?? key;
      return interpolate(template, params);
    },
    [theme, locale],
  );
}
