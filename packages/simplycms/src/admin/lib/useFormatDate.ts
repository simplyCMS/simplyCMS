import { useMemo } from 'react';
import { useUiLocale } from 'simplycms/i18n';

/** Форматувач дати за локаллю інтерфейсу; один на локаль, а не на рендер. */
export function useFormatDate(
  style: 'medium' | 'short' = 'medium',
): (d: Date) => string {
  const locale = useUiLocale();
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { dateStyle: style });
    return (d) => f.format(d);
  }, [locale, style]);
}
