import { createFileRoute } from '@tanstack/react-router';
import CatalogPage from 'simplycms/storefront-routes/pages/Catalog';
import { getSections } from 'simplycms/storefront-routes/server/sections';
import { getProducts } from 'simplycms/storefront-routes/server/products';

export const Route = createFileRoute('/_storefront/catalog/')({
  staleTime: 60_000,
  loader: async () => {
    const [sections, products] = await Promise.all([
      getSections(),
      getProducts(),
    ]);
    return {
      initialSections: sections,
      initialProducts: products.items,
      priceContext: products.priceContext,
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
