// Хлібні крихти каталогу й сторінки розділу.

import type { Translator } from 'simplycms/i18n';
import type { BreadcrumbItem } from 'simplycms/contracts/views';

/** Головна → каталог (остання ланка без `href` — рендериться текстом). */
export function buildCatalogBreadcrumbs(t: Translator): BreadcrumbItem[] {
  return [
    { label: t('breadcrumbs.home'), href: '/' },
    { label: t('catalog.title') },
  ];
}

/** Головна → каталог → розділ. */
export function buildSectionBreadcrumbs(
  t: Translator,
  sectionName: string,
): BreadcrumbItem[] {
  return [
    { label: t('breadcrumbs.home'), href: '/' },
    { label: t('catalog.title'), href: '/catalog' },
    { label: sectionName },
  ];
}
