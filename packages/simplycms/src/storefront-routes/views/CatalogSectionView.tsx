import type { CatalogSectionViewModel } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { CatalogLayout, CatalogPageHeader } from './CatalogLayout';
import { StorefrontBreadcrumbs } from './StorefrontBreadcrumbs';

/**
 * Канонічний view сторінки розділу (контракт тем v3). Кістяк — той самий, що
 * в каталозі (`CatalogLayout`); розділ додає власну назву в шапці й HTML-опис
 * під вибіркою.
 */
export function CatalogSectionView({
  breadcrumbs,
  productCount,
  section,
  slots,
}: CatalogSectionViewModel) {
  const t = useT();

  return (
    <div className="container mx-auto px-4 py-8">
      <StorefrontBreadcrumbs items={breadcrumbs} />
      <CatalogPageHeader
        title={section.name}
        subtitle={t('catalog.subtitle')}
      />
      <CatalogLayout productCount={productCount} slots={slots} />

      {section.description && (
        <div className="mt-12 pt-8 border-t">
          <h2 className="text-2xl font-bold mb-4">{section.name}</h2>
          <div
            className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: section.description }}
          />
        </div>
      )}
    </div>
  );
}
