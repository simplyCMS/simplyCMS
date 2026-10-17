import type { ReactNode } from 'react';

/**
 * Фрагмент тексту, узятий з основної мови (fallback неперекладеного поля).
 *
 * Сторінка іншою мовою показує його мовою джерела, тож він мусить мати свій
 * `lang`: інакше скрінрідери читають його з вимовою мови сторінки (І37). Коли
 * `lang` не задано — текст мовою сторінки, обгортки немає, розмітка не обростає
 * порожніми `span`. `as="div"` — для блокової розмітки (опис із редактора), яку
 * в `span` класти не можна.
 *
 * Живе в `ui`, а не в `storefront-routes`: картка товару (`catalog-ui`, тір нижче) теж
 * показує fallback-назву, а імпорт угору по тірах був би винятком зони.
 */
export function FallbackText({
  lang,
  as = 'span',
  children,
}: {
  lang?: string | null;
  as?: 'span' | 'div';
  children: ReactNode;
}) {
  if (!lang) return <>{children}</>;
  const Tag = as;
  return <Tag lang={lang}>{children}</Tag>;
}
