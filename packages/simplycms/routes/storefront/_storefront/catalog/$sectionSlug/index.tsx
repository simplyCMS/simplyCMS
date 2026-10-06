import { createFileRoute, notFound } from '@tanstack/react-router';
import CatalogSectionPage from 'simplycms/storefront-routes/pages/CatalogSection';
import { getSectionPageData } from 'simplycms/storefront-routes/server/catalog';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

export const Route = createFileRoute('/_storefront/catalog/$sectionSlug/')({
  staleTime: 60_000,
  loader: async ({ params: { sectionSlug } }) => {
    // Один похід на сервер замість двох послідовних: розділ, перелік розділів
    // і товари приходять однією транзакцією вітрини.
    const data = await getSectionPageData({ data: { slug: sectionSlug } });

    if (!data) {
      throw notFound();
    }

    return {
      sectionSlug,
      initialSection: data.section,
      initialSections: data.sections,
      initialProducts: data.products.items,
      priceContext: data.products.priceContext,
    };
  },
  head: ({ loaderData, matches }) =>
    storefrontHead(matches, (t) => ({
      title: loaderData?.initialSection?.name ?? t('catalog.title'),
      description: loaderData?.initialSection?.description,
    })),
  component: CatalogSection,
});

function CatalogSection() {
  const data = Route.useLoaderData();

  return (
    <CatalogSectionPage
      sectionSlug={data.sectionSlug}
      initialSection={data.initialSection}
      initialSections={data.initialSections}
      initialProducts={data.initialProducts}
    />
  );
}
