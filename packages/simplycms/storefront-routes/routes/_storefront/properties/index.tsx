import { createFileRoute } from '@tanstack/react-router';
import PropertiesPage from '@simplycms/storefront-routes/pages/Properties';
import { getProperties } from '@simplycms/storefront-routes/server/properties';

export const Route = createFileRoute('/_storefront/properties/')({
  staleTime: 60_000,
  loader: async () => {
    const properties = await getProperties();
    return { properties };
  },
  head: () => ({
    meta: [
      { title: 'Характеристики — SimplyCMS Store' },
      {
        name: 'description',
        content: 'Список характеристик товарів',
      },
    ],
  }),
  component: Properties,
});

function Properties() {
  const { properties } = Route.useLoaderData();

  return <PropertiesPage properties={properties} />;
}
