// Хлібні крихти картки товару.

import type { Translator } from 'simplycms/i18n';
import type { BreadcrumbItem } from 'simplycms/contracts/views';
import type { ProductSectionRef } from './types';

/**
 * Головна → каталог → розділ (якщо є) → сам товар.
 *
 * Останню ланку віддаємо БЕЗ `href` — view рендерить її текстом, як і до
 * спліту.
 */
export function buildBreadcrumbs(
  t: Translator,
  section: ProductSectionRef | null,
  productName: string,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: t('breadcrumbs.home'), href: '/' },
    { label: t('catalog.title'), href: '/catalog' },
  ];

  if (section) {
    items.push({ label: section.name, href: `/catalog/${section.slug}` });
  }

  items.push({ label: productName });
  return items;
}
