import type { CatalogViewModel } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { CatalogLayout, CatalogPageHeader } from './CatalogLayout';
import { StorefrontBreadcrumbs } from './StorefrontBreadcrumbs';

/**
 * Канонічний view каталогу (контракт тем v3).
 *
 * 🔴 Чиста функція від view-model: жодних запитів і жодного доступу до БД —
 * вибірку, фільтри й стан тримає контейнер, сюди приїжджають готові значення
 * та прибінджені реквізити. Тема може підмінити цей view своїм.
 */
export function CatalogView({
  breadcrumbs,
  productCount,
  slots,
}: CatalogViewModel) {
  const t = useT();

  return (
    <div className="container mx-auto px-4 py-8">
      <StorefrontBreadcrumbs items={breadcrumbs} />
      <CatalogPageHeader
        title={t('catalog.title')}
        subtitle={t('catalog.subtitle')}
      />
      <CatalogLayout productCount={productCount} slots={slots} />
    </div>
  );
}
