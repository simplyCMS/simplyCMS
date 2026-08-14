import { useCallback } from 'react';
import { interpolate, useLocale, type MessageParams } from '@simplycms/i18n';
import type { PluginMessages } from './types';

/**
 * Транслятор каталогу ПЛАГІНА (не ядра) — двійник `useThemeT`.
 *
 * Ланцюжок fallback — `messages[locale][key] → messages.uk[key] → сам key`;
 * підстановка `{param}` — та сама `interpolate` з `@simplycms/i18n`.
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
export function usePluginT<K extends string = string>(
  messages: PluginMessages | undefined,
): (key: K, params?: MessageParams) => string {
  const locale = useLocale();

  return useCallback(
    (key: K, params?: MessageParams): string => {
      const template = messages?.[locale]?.[key] ?? messages?.uk?.[key] ?? key;
      return interpolate(template, params);
    },
    [messages, locale],
  );
}
