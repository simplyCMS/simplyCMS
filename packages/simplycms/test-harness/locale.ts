// Фікстури осі контенту для тестів: літерали мов проходять через єдиний конструктор
// `checkedContentLocale`, а не приведення `as ContentLocale` (спека §19.2).
import type { ContentLocale, LocaleSet } from 'simplycms/contracts';
import { checkedContentLocale } from 'simplycms/domain/translations';

/** Коротка назва конструктора для фікстур. */
export const cl: (code: string) => ContentLocale = checkedContentLocale;

/** Набір мов: `known` за замовчуванням дорівнює `published`. */
export function localeSet(
  primary: string,
  published: readonly string[] = [primary],
  known: readonly string[] = published,
): LocaleSet {
  return {
    primary: cl(primary),
    published: published.map(cl),
    known: known.map(cl),
  };
}
