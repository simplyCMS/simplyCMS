import { useParams, Link } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useT } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import type { ProductListItem } from '../server/product-list-item';
import { CatalogSectionView } from '../views/CatalogSectionView';
import { useStorefrontViews } from '../views/useStorefrontViews';
import { buildSectionBreadcrumbs } from './catalog/breadcrumbs';
import { CatalogSlotBindings } from './catalog/slot-context';
import { catalogSlots } from './catalog/slots';
import {
  useSectionQuery,
  type CatalogSectionRow,
} from './catalog/useCatalogQueries';
import { useCatalogController } from './catalog/useCatalogController';

export interface CatalogSectionPageProps {
  sectionSlug?: string;
  initialSection?: CatalogSectionRow;
  initialSections?: CatalogSectionRow[];
  initialProducts?: ProductListItem[];
}

/**
 * Контейнер сторінки розділу: та сама механіка вибірки, що в каталозі
 * (`useCatalogController`), але звужена розділом на рівні запиту.
 */
export default function CatalogSectionPage({
  sectionSlug: propSectionSlug,
  initialSection,
  initialSections,
  initialProducts,
}: CatalogSectionPageProps = {}) {
  const t = useT();
  const params = useParams({ strict: false }) as { sectionSlug?: string };
  const sectionSlug = propSectionSlug || params.sectionSlug;

  const { data: section, isLoading: sectionLoading } = useSectionQuery(
    sectionSlug,
    initialSection,
  );
  const { productCount, bindings } = useCatalogController({
    sectionId: section?.id ?? null,
    initialSections,
    initialProducts,
  });
  const views = useStorefrontViews({ CatalogSection: CatalogSectionView });

  if (sectionLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">
          {t('catalog.sectionNotFound')}
        </h1>
        <Link to="/catalog">
          <Button>{t('catalog.back')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <CatalogSlotBindings value={bindings}>
      <views.CatalogSection
        breadcrumbs={buildSectionBreadcrumbs(t, section.name)}
        productCount={productCount}
        section={{
          id: section.id,
          name: section.name,
          slug: section.slug,
          description: section.description ?? null,
        }}
        slots={catalogSlots}
      />
    </CatalogSlotBindings>
  );
}
