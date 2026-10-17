import { createFileRoute } from '@tanstack/react-router';
import CatalogPage from 'simplycms/storefront-routes/pages/Catalog';
import { getCatalogPageData } from 'simplycms/storefront-routes/server/catalog';
import { localeOfHref } from 'simplycms/storefront-routes/locale/root-data';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

export const Route = createFileRoute('/_storefront/catalog/')({
  staleTime: 60_000,
  loader: async ({ location, context }) => {
    const data = await getCatalogPageData({
      data: { locale: localeOfHref(location.publicHref, context.locales) },
    });
    return {
      initialSections: data.sections,
      initialProducts: data.products.items,
      priceContext: data.products.priceContext,
    };
  },
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('catalog.title') })),
  component: Catalog,
});

function Catalog() {
  const data = Route.useLoaderData();

  return (
    <CatalogPage
      initialSections={data.initialSections}
      initialProducts={data.initialProducts}
    />
  );
}
