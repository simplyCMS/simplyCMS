import { createFileRoute } from '@tanstack/react-router';
import CatalogPage from 'simplycms/storefront-routes/pages/Catalog';
import { getCatalogPageData } from 'simplycms/storefront-routes/server/catalog';

export const Route = createFileRoute('/_storefront/catalog/')({
  staleTime: 60_000,
  loader: async () => {
    const data = await getCatalogPageData();
    return {
      initialSections: data.sections,
      initialProducts: data.products.items,
      priceContext: data.products.priceContext,
    };
  },
  head: () => ({
    meta: [
      { title: 'Каталог — SimplyCMS Store' },
      {
        name: 'description',
        content: 'Каталог товарів інтернет-магазину SimplyCMS Store',
      },
    ],
  }),
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
