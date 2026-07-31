import { createFileRoute, notFound } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplycms/themes/ThemeContext';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';
import { getSectionBySlug } from '../../../../server/sections';
import { getSections } from '../../../../server/sections';
import { getProductsBySectionId } from '../../../../server/products';

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
      initialProducts: products,
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
  component: CatalogSectionPage,
});

function CatalogSectionPage() {
  const data = Route.useLoaderData();
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return (
    <theme.pages.CatalogSectionPage
      sectionSlug={data.sectionSlug}
      initialSection={data.initialSection}
      initialSections={data.initialSections}
      initialProducts={data.initialProducts}
    />
  );
}
