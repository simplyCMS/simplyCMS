import { useMemo } from 'react';
import {
  createLookupTranslator,
  useUiLocalePair,
  type PluralTranslator,
} from 'simplycms/i18n';
import type { PluginMessages } from './types';

/**
 * Транслятор каталогу ПЛАГІНА (не ядра) — двійник `useThemeT`.
 *
 * Ланцюжок — той самий `lookupMessage` з `simplycms/i18n`:
 * `messages[locale][key] → messages[основна][key] → сам key`.
 *
 * Каталог передається АРГУМЕНТОМ (компонент плагіна імпортує власний
 * `messages.ts`), а не читається з реєстру плагінів: реєстр наповнюється в
 * клієнтському `useEffect` (`bootstrapPlugins`), і читання з нього на SSR
 * віддало б сирі ключі — рівно гідраційна пастка, задокументована в
 * `useThemeT.ts`. Статичний імпорт каталогу SSR-стабільний за побудовою.
 *
 * Generic `K` — локальний union плагіна
 * (`export type FaqKey = keyof typeof messages.uk` у `messages.ts` плагіна),
 * НЕ `MessageKey` ядра: SDK про ключі конкретного плагіна нічого не знає.
 */
export function usePluginT<
  K extends string = string,
  P extends string = string,
>(messages: PluginMessages | undefined): PluralTranslator<K, P> {
  const { locale, fallback } = useUiLocalePair();

  return useMemo(
    () =>
      createLookupTranslator<K, P>(
        // Кожна ланка несе свою мову: форми з каталогу fallback множаться за його правилами.
        [
          { locale, catalog: messages?.[locale] },
          { locale: fallback, catalog: messages?.[fallback] },
        ],
        locale,
      ),
    [messages, locale, fallback],
  );
}
