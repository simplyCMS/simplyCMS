import type { CatalogViewModel } from '@simplycms/objects/views';
import { useT } from '@simplycms/i18n';
import { CatalogShell } from './catalog/CatalogShell';

/**
 * View каталогу default-теми (контракт тем v3).
 *
 * Спека — `docs/design-references/ref/views/Catalog.spec.md`. Заголовок і
 * підпис беруться з каталогу ЯДРА (`catalog.title`/`catalog.subtitle`):
 * дублювати наявні рядки в каталог теми заборонено.
 *
 * 🔴 Чиста функція від view-model: вибірку, фільтри й стан тримає контейнер
 * ядра, сюди приїжджають готові значення та прибінджені реквізити.
 */
export function CatalogView({
  breadcrumbs,
  productCount,
  slots,
}: CatalogViewModel) {
  const t = useT();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <CatalogShell
        breadcrumbs={breadcrumbs}
        title={t('catalog.title')}
        subtitle={t('catalog.subtitle')}
        productCount={productCount}
        slots={slots}
      />
    </div>
  );
}
