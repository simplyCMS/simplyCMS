import { useT } from 'simplycms/i18n';
import type { ProductListItem } from '../server/product-list-item';
import { CatalogView } from '../views/CatalogView';
import { useStorefrontViews } from '../views/useStorefrontViews';
import { buildCatalogBreadcrumbs } from './catalog/breadcrumbs';
import { CatalogSlotBindings } from './catalog/slot-context';
import { catalogSlots } from './catalog/slots';
import type { CatalogSectionRow } from './catalog/useCatalogQueries';
import { useCatalogController } from './catalog/useCatalogController';

export interface CatalogPageProps {
  initialSections?: CatalogSectionRow[];
  initialProducts?: ProductListItem[];
}

/**
 * Контейнер каталогу: тягне вибірку, тримає стан фільтрів, сортування й
 * вибраного розділу — і віддає готовий view-model view (темовому, якщо тема
 * його заявила, інакше канонічному).
 */
export default function CatalogPage({
  initialSections,
  initialProducts,
}: CatalogPageProps = {}) {
  const t = useT();
  const { productCount, bindings } = useCatalogController({
    initialSections,
    initialProducts,
  });
  const views = useStorefrontViews({ Catalog: CatalogView });

  return (
    <CatalogSlotBindings value={bindings}>
      <views.Catalog
        breadcrumbs={buildCatalogBreadcrumbs(t)}
        productCount={productCount}
        slots={catalogSlots}
      />
    </CatalogSlotBindings>
  );
}
