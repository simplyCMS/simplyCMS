import { useMemo } from 'react';
import { useUiLocale } from './I18nProvider';

/**
 * Форматувач дати за мовою ІНТЕРФЕЙСУ (спека §19.8): дата читається мовою кнопок поруч, а
 * не мовою контенту чи регіоном із конфігу. Один на мову й стиль, а не на рендер.
 * `datetime` — довга дата з часом (картка замовлення покупця).
 */
export function useFormatDate(
  style: 'medium' | 'short' | 'datetime' = 'medium',
): (d: Date) => string {
  const locale = useUiLocale();
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(
      locale,
      style === 'datetime'
        ? { dateStyle: 'long', timeStyle: 'short' }
        : { dateStyle: style },
    );
    return (d) => f.format(d);
  }, [locale, style]);
}
