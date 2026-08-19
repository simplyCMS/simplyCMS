// Хлібні крихти кошика.

import type { Translator } from '@simplycms/i18n';
import type { BreadcrumbItem } from '@simplycms/objects/views';

/** Головна → сам кошик (остання ланка без `href` — рендериться текстом). */
export function buildCartBreadcrumbs(t: Translator): BreadcrumbItem[] {
  return [
    { label: t('breadcrumbs.home'), href: '/' },
    { label: t('cart.title') },
  ];
}
