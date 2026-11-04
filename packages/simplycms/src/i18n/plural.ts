import { interpolate } from './lookup';
import type { MessageParams, PluralSource } from './types';

/**
 * `Intl.PluralRules` дорогий у створенні, а правила мови незмінні: кеш за кодом мови.
 * Це мемо чистої функції, а не стан запиту — SSR-безпечно.
 */
const rulesCache = new Map<string, Intl.PluralRules>();

function rulesFor(locale: string): Intl.PluralRules {
  let rules = rulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    rulesCache.set(locale, rules);
  }
  return rules;
}

/**
 * Форма множини для `count`: категорія за `Intl.PluralRules` МОВИ КАТАЛОГУ, де знайдено
 * форми (для fallback-каталогу теми це не мова інтерфейсу); категорії немає серед форм
 * ключа — `other`. `{count}` у формі підставляється автоматично (виклик може передати й
 * інші параметри).
 *
 * Правила множини живуть у рушії (CLDR), а не в коді компонента: ручні `mod10/mod100`
 * розходилися б з мовою, яку додав власник магазину. Один виклик для ядра, тем і плагінів —
 * транслятор будь-якого рівня віддає `locale` і `forms`.
 *
 * Ключа-множини немає ніде в ланцюзі каталогів — сам ключ (видимий сигнал, як у `t()`).
 */
export function plural<P extends string>(
  t: PluralSource<P>,
  key: P,
  count: number,
  params?: MessageParams,
): string {
  const found = t.forms(key);
  if (!found) return key;
  const { forms, locale } = found;
  // Правила — мови каталогу, де знайдено форми (fallback-каталог теми не говорить мовою
  // інтерфейсу), а не `t.locale`.
  const category = rulesFor(locale).select(count);
  return interpolate(forms[category] ?? forms.other, { ...params, count });
}
