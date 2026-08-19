import type { CatalogSectionViewModel } from '@simplycms/objects/views';
import { useT } from '@simplycms/i18n';
import { CatalogShell } from './catalog/CatalogShell';
import { ViewPanel, ViewPanelHeading } from './parts/ViewPanel';

/**
 * View сторінки розділу default-теми (контракт тем v3).
 *
 * Кістяк спільний із каталогом (`CatalogShell`); розділ додає власну назву в
 * шапці й панель HTML-опису під вибіркою — у картковій ідіомі референсу,
 * а не окремою секцією з рамкою, як у каноні.
 */
export function CatalogSectionView({
  breadcrumbs,
  productCount,
  section,
  slots,
}: CatalogSectionViewModel) {
  const t = useT();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <CatalogShell
        breadcrumbs={breadcrumbs}
        title={section.name}
        subtitle={t('catalog.subtitle')}
        productCount={productCount}
        slots={slots}
      />

      {section.description && (
        <ViewPanel className="mt-8">
          <ViewPanelHeading>{section.name}</ViewPanelHeading>
          <div
            className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: section.description }}
          />
        </ViewPanel>
      )}
    </div>
  );
}
