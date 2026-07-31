import { createFileRoute, notFound } from '@tanstack/react-router';
import CatalogSectionPage from '@simplycms/storefront-routes/pages/CatalogSection';
import { getSectionBySlug } from '@simplycms/storefront-routes/server/sections';
import { getSections } from '@simplycms/storefront-routes/server/sections';
import { getProductsBySectionId } from '@simplycms/storefront-routes/server/products';

export const Route = createFileRoute('/_storefront/catalog/$sectionSlug/')({
  staleTime: 60_000,
  loader: async ({ params: { sectionSlug } }) => {
    const section = await getSectionBySlug({ data: { slug: sectionSlug } });

    if (!section) {
      throw notFound();
    }

    const [sections, products] = await Promise.all([
      getSections(),
      getProductsBySectionId({ data: { sectionId: section.id } }),
    ]);

    return {
      sectionSlug,
      initialSection: section,
      initialSections: sections,
      initialProducts: products.items,
      priceContext: products.priceContext,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.initialSection?.name ?? 'Секція'} — SimplyCMS Store`,
      },
      {
        name: 'description',
        content: loaderData?.initialSection?.description ?? '',
      },
    ],
  }),
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
