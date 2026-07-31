import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplycms/themes/ThemeContext';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';
import { getSections } from '@simplycms/storefront-routes/server/sections';
import { getProducts } from '@simplycms/storefront-routes/server/products';

export const Route = createFileRoute('/_storefront/catalog/')({
  staleTime: 60_000,
  loader: async () => {
    const [sections, products] = await Promise.all([
      getSections(),
      getProducts(),
    ]);
    return { initialSections: sections, initialProducts: products };
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
  component: CatalogPage,
});

function CatalogPage() {
  const data = Route.useLoaderData();
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return (
    <theme.pages.CatalogPage
      initialSections={data.initialSections}
      initialProducts={data.initialProducts}
    />
  );
}
